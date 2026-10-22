# Leçon 8 — Le contrat vérifiable

Il est 10 h 05 un mardi et arrive le premier message de l'équipe d'intégration d'une autre entreprise, celle qui construit depuis trois semaines son programme contre l'API du `revisor`. Ils disent que leur client est devenu fou : il réessaie toutes les cinquante millisecondes, sans s'arrêter, contre le mode maintenance. Quelqu'un de ton équipe regarde les journaux et ne trouve rien d'étrange. Le mode maintenance répond `503`, comme toujours. Les tests de l'équipe sont passés hier soir, tous au vert, et le tableau de bord de disponibilité est vert. À 10 h 20 arrive le deuxième message : leur programme ne reconnaît plus les erreurs. Il attendait un `application/problem+json` et reçoit un `application/json`, de sorte que la branche qui lit le `type` ne s'exécute pas et qu'il retombe sur celle qui réessaie à l'aveugle. À 10 h 40, un troisième : le `503` n'apporte plus `Retry-After`, et leur programme, sans ce nombre, utilise celui qu'il avait par défaut, qui est presque rien.

La cause apparaît à 11 h 00, dans une revue de ce qui a été versionné lundi. Quelqu'un a fait un « nettoyage » du gestionnaire central d'erreurs : il a unifié le type de contenu de toutes les réponses et, au passage, supprimé un en-tête qui lui semblait superflu. Aucun des **codes** n'a changé. Un `503` reste un `503` ; un `404`, un `404`. Et comme les tests de l'équipe ne posaient de question que sur le code, aucun ne l'a remarqué. Ce qui a changé, c'est tout le reste de ce que l'API promettait dans ses réponses : le type de contenu, l'en-tête d'attente, la façon dont une machine décide quoi faire. Et cette promesse n'était écrite nulle part où un programme aurait pu la comparer avec la réalité.

Cette promesse est ce que construit cette leçon : une description de l'API dans un format que les machines lisent (OpenAPI), et une **matrice** qui, avec une seule commande, fait 23 requêtes, regarde ce que l'API répond réellement et le compare avec ce qui a été promis, en-têtes, type de contenu et forme du corps compris. Si quelqu'un refait un nettoyage comme celui de lundi, la matrice passe au rouge le lundi même, pas le mardi à 10 h 05.

**Durée :** 2 × 45 min (la coupure se situe entre les sections 8.7 et 8.8)

**Ce que tu construis :** la description OpenAPI 3.1 du `revisor` (`openapi.json`), avec chaque route, chaque erreur et chaque en-tête ; la matrice de 23 scénarios (`matriz23.ts`) qui démarre le serveur, parcourt un scénario par code et s'arrête toute seule ; la même matrice écrite avec `curl` (`fig08_03.sh`) ; un programme qui croise le catalogue de types de problème avec le document (`fig08_02.ts`) ; et la fermeture de la défense contre le *DNS rebinding* dans `cliente.ts`, avec une simulation qui le démontre (`fig08_04.ts`) et un contre-essai du certificat (`fig08_07.ts`) ; et les programmes avec lesquels on a mesuré une vérification qui échouait parfois (`fig08_05.ts` pour une situation de compétition (race condition) réseau, `fig08_06.ts` pour le temps de démarrage d'un processus et `fig08_08.sh` pour répéter la matrice)

**Ce que tu apprends :** ce qu'est une description OpenAPI et comment la lire en cinq pièces (`info`, `servers`, `security`, `paths` et `components`) ; comment documenter chaque erreur avec des réponses réutilisables, le schéma `Problema` et les en-têtes que chaque code impose ; comment vérifier que le catalogue de types et le document disent la même chose ; ce que vérifie une matrice et ce qu'elle ne vérifie pas, et comment on démontre qu'un test « mord » en défaisant la correction et en le voyant au rouge ; la différence entre un document **valide** et un document **vrai** ; le *DNS rebinding* et pourquoi se connecter à l'adresse déjà validée le referme ; et comment on documente dans OpenAPI le retrait annoncé d'une version

**D'où tu viens.** De la [Leçon 7](07-quien-lee-el-error.md), avec un `revisor` complet sur ses deux faces : comme serveur, il produit les 23 codes avec leurs Problem Details, et comme client, il décide, avec un tableau, s'il faut continuer, corriger, se réauthentifier, attendre, réconcilier ou renoncer. De la [Leçon 5](05-problem-details.md), tu hérites du catalogue de types de problème (`problemas.ts`) et du programme de treize vérifications qui annonçait cette matrice ; de la [Leçon 6](06-reintentos-idempotencia.md), de l'en-tête `Idempotency-Key`, qu'on documente ici en précisant que ce n'est pas un standard, et du vérificateur de cinq tests, que la matrice reprend ; de la [Leçon 3](03-errores-del-cliente-estado.md), des avis `Deprecation` et `Sunset` de la version 1 ; de la [Leçon 2](02-errores-del-cliente-peticion.md), de la décision que la forme de l'API n'est pas un secret, parce qu'elle va figurer dans un document que n'importe qui peut lire ; et de la [Leçon 1](01-exitos-redirecciones.md), de la limite qui était restée déclarée : le *DNS rebinding*, dont la défense complète arrive aujourd'hui.

**Ce que cette leçon ne fait pas.** Elle ne génère ni clients ni serveurs à partir du document : le document s'écrit à la main et se vérifie contre le serveur, ce qui est un choix du cours et pas le seul possible. Elle ne compare pas le corps de chaque réponse à son schéma JSON champ par champ : la matrice vérifie que le code, les en-têtes, le type de contenu et les membres principaux du corps sont présents, et l'exercice 2 l'étend d'un pas. Elle ne publie pas de page de documentation avec le document (des visionneuses qui le font existent, et le cours ne les utilise pas). Elle ne décrit pas l'authentification OAuth ni d'autres schémas : les identifiants du `revisor` sont des identifiants d'entraînement, et le document les déclare comme `bearer`. Et elle ne promet pas qu'une matrice verte signifie une API sans défauts : la section 8.14 dit ce qu'elle ne voit pas.

**À propos des exécutions.** Linux Mint 22 est le système de référence du cours. Les sorties de cette leçon ont été obtenues le 21 octobre 2026 sur macOS, avec Node 24.14.1 (la version 24 LTS avec laquelle tout le cours s'exécute ; il existe des versions 24.x ultérieures, et les sorties viennent de celle-là) et curl 8.7.1. Le validateur OpenAPI de la section 8.11 est Redocly CLI 2.57.0 (publié le 30 septembre 2026), installé avec `npm install` dans un dossier à part, parce que c'est un outil de vérification et non une dépendance des programmes, qui restent sans aucune. Redocly écrit une partie de sa sortie sur la sortie d'erreur et, s'il existe une version plus récente, imprime un encadré d'avertissement ; c'est pourquoi ses exécutions portent `2>&1` et la variable `REDOCLY_SUPPRESS_UPDATE_NOTICE=true`, qui ne masquent que cet encadré. La vérification des types a utilisé TypeScript 7.0.2, comme dans les leçons précédentes. Pendant la rédaction de cette leçon, d'autres essais occupaient les ports du cours ; les séries ont donc été exécutées avec une copie des programmes identique sauf pour les ports (chaque série avec les siens, vérifiés libres avant l'exécution), et dans les sorties collées ici (et dans leurs fichiers `.salida.txt`), on a réécrit 18080, 18081 et 18082, qui sont ceux que tu vas taper. Ce sont des nombres de même longueur, donc aucun `Content-Length` ne change. Dans ton exécution, vont changer la date de `Date`, les huit derniers chiffres de chaque `ETag`, les millisecondes mesurées (`ms`), le temps que mesure Redocly et les `urn:uuid:` des erreurs `500`. Les essais de la section 8.12 qui interrogent `https://example.com`, `https://expired.badssl.com` et `https://wrong.host.badssl.com` ont besoin d'internet ; si ta machine n'en a pas, saute cette série et les autres continuent de même. La matrice complète prend une quinzaine de secondes sur un portable (environ 16). En exécutant la matrice des dizaines de fois de suite, on a trouvé une situation de compétition (race condition) entre la fermeture d'une connexion et l'envoi d'un corps ; la section 8.14 raconte comment on l'a trouvée, comment on l'a mesurée et comment on l'a refermée, avec les chiffres d'avant et d'après. Les programmes se trouvent dans [`programas/08-contrato-verificable/`](../programas/08-contrato-verificable), dans le dépôt du cours : le `revisor` complet dans `fig08_01/`, le croisement du catalogue dans `fig08_02.ts`, la matrice avec `curl` dans `fig08_03.sh`, la simulation du *DNS rebinding* dans `fig08_04.ts`, le contre-essai du certificat dans `fig08_07.ts`, les mesures de la section 8.14.1 dans `fig08_05.ts`, `fig08_06.ts` et `fig08_08.sh`, les défauts volontaires dans `defectos/`, les solutions des exercices dans `ejercicios/` et chaque exécution dans son fichier `.salida.txt`. Tous passent `tsc` en mode strict (section 8.16).

## À la fin, tu seras capable de

- Lire un document OpenAPI 3.1 et en identifier les cinq pièces principales, et expliquer ce que fait une référence `$ref` et pourquoi les réponses d'erreur s'écrivent une fois et se réutilisent.
- Documenter une réponse d'erreur complète : son code, son type de contenu `application/problem+json`, le schéma `Problema` et l'en-tête que ce code impose (`Allow` pour un `405`, `Retry-After` pour un `429` et un `503`, `WWW-Authenticate` pour un `401`).
- Exécuter un programme qui croise le catalogue de types de problème avec le document, et expliquer pourquoi il trouve aujourd'hui une lacune et comment on la comble.
- Exécuter la matrice de 23 scénarios avec une seule commande, la lire ligne par ligne et dire ce qui est vérifié dans chaque scénario : code, en-têtes, type de contenu, corps, fuites dans les `5xx` et présence dans le document.
- Provoquer volontairement deux pannes, l'une dans le serveur et l'autre dans le document, et lire la matrice au rouge ; et expliquer pourquoi un validateur externe peut dire « valide » devant un document qui ment.
- Expliquer ce qu'est le *DNS rebinding*, pourquoi valider avant chaque connexion ne le ferme pas tout à fait, et montrer par une exécution que le client de la leçon arrive au bon serveur alors que celui qui utilise `fetch` arrive au mauvais.
- Documenter dans OpenAPI le retrait annoncé d'une version, avec `deprecated: true` et les en-têtes `Deprecation`, `Sunset` et `Link`.
- Dire, avec des exemples mesurés, ce que la matrice ne peut pas voir, et l'étendre d'un pas pour qu'elle le voie.

## Le pourquoi avant le comment

Une API est une promesse faite à des gens qui ne sont pas dans la salle. Celui qui l'a écrite sait ce qu'elle fait ; celui qui l'utilise ne sait que ce qu'on lui a dit. Entre les deux, il y a un document, et ce document a un défaut de naissance : il est de papier. Il s'écrit une fois, se lit avec soin une fois, et à partir de ce moment le code change tous les jours et le document ne change que lorsque quelqu'un y pense. Avec le temps, le document cesse de décrire l'API et se met à décrire ce qu'était l'API quand quelqu'un a pensé à le mettre à jour.

Il y a deux remèdes, et cette leçon réunit les deux. Le premier est que le document soit **lisible par les machines** : si c'est un fichier structuré, un programme peut le lire, et ce qu'un programme peut lire, un programme peut le comparer. Le second est que cette comparaison **s'exécute toute seule**, à chaque changement, avec une seule commande, et qu'elle échoue avec un message qui dit quelle promesse a été rompue. Un document qu'on compare chaque jour à la réalité ressemble beaucoup à un test ; un test qu'on écrit à partir d'un document ressemble beaucoup à une promesse. D'où le nom de la leçon : un contrat *vérifiable* est un contrat qu'on peut vérifier sans demander la permission à personne.

Cet ordre a une conséquence inconfortable, qu'il vaut mieux dire d'emblée : il y a trois endroits où peut se trouver le mensonge. Il peut se trouver dans le **serveur**, qui a changé alors que le document non (la scène du début). Il peut se trouver dans le **document**, qui dit quelque chose que le serveur n'a jamais fait. Et il peut se trouver dans le **test**, qui, vert ou rouge, ne regarde pas ce qui compte. Un validateur OpenAPI ne peut que dire si le document est bien écrit ; il ne sait rien du serveur. Un test de codes ne regarde que les codes. La matrice de cette leçon regarde les trois endroits à la fois, et elle a pourtant des angles morts que la section 8.14 énumère, parce qu'une vérification qui ne dit pas ce qu'elle ne voit pas a le même problème que le document de papier.

La leçon comporte cinq parties :

1. **Le document** (8.1 à 8.5) : ce qu'est OpenAPI, comment on le lit, comment on documente les erreurs et comment on croise le catalogue de types avec ce qui est écrit.
2. **La matrice** (8.6 à 8.9) : comment elle est faite, ce qu'elle vérifie dans chaque scénario, comment on l'exécute et sa version avec `curl`.
3. **Que le test morde** (8.10 et 8.11) : comment on démontre qu'une vérification détecte ce qu'elle dit détecter, et pourquoi un document valide n'est pas la même chose qu'un document vrai.
4. **La lacune qui reste de la Leçon 1** (8.12) : le *DNS rebinding* et sa fermeture.
5. **Versions et limites** (8.13 à 8.16) : le retrait annoncé d'une version dans le document, ce que la matrice ne promet pas, le `revisor` complet et la vérification des types.

## Les concepts

### 8.1 Le `revisor` de cette leçon

#### 8.1.1 Ce qui change

Le `revisor` de la Leçon 7 gagne deux nouveaux fichiers, `matriz23.ts` et `openapi.json`, et en modifie trois : `cliente.ts`, `destinos.ts` et `respuestas.ts`. Tout le reste est celui des leçons précédentes dans sa version en vigueur, et les routes, les codes, les en-têtes et les noms des champs ne changent pas.

- **`openapi.json`** (nouveau) est la description de l'API en OpenAPI 3.1.1 : chaque route, chaque méthode, chaque réponse (succès et erreurs), les schémas des corps et les en-têtes. C'est le centre des sections 8.3 à 8.5.
- **`matriz23.ts`** (nouveau) démarre le laboratoire et le `revisor`, parcourt 23 scénarios (un par code du cours) et dix-huit vérifications supplémentaires, puis les arrête. Au lieu d'attendre un temps fixe après avoir démarré chaque processus, il attend que le port accepte des connexions, et si un port est déjà occupé, il ne mesure rien et le dit. Il sort avec le code `0` si tout est passé et avec `1` si quelque chose a échoué (`2` s'il n'a pas pu commencer parce qu'un port était occupé). C'est le centre des sections 8.6 à 8.10.
- **`cliente.ts`** change dans `consultar` et gagne deux fonctions d'appui, `soloA` et `pedir` : au lieu de `fetch`, il utilise `http.request` ou `https.request` et se connecte à l'adresse que `destinos.ts` a déjà validée. C'est la section 8.12.
- **`respuestas.ts`** change dans une seule fonction : quand le corps dépasse le plafond, le `413` part immédiatement et la connexion se ferme **par étapes** (d'abord l'écriture seulement ; le serveur continue de lire et de jeter ce qui arrive, et détruit la connexion au bout de 2 secondes). C'est l'histoire de la section 8.14.1.
- **`destinos.ts`** change une chose : `revisarDestino` renvoie désormais, avec le « oui », les adresses qu'il a validées (`{ permitido: true, direcciones }`), pour que celui qui se connecte utilise l'une d'elles et n'interroge plus le DNS.

Les issues de `consultar` ne changent pas : il y a toujours les cinq mêmes types de résultat (réponse, délai dépassé, pas de connexion, réponse invalide et destination interdite), la même classification en `ARRIBA`, `LENTO` et `CAIDO`, et les mêmes codes dans chaque réponse du serveur. C'est pourquoi `revisar.ts`, `tabla23.ts` et `por-type.ts`, les trois programmes de la Leçon 7, donnent la même chose qu'avant.

#### 8.1.2 Monter le dossier et vérifier que cela tourne

Le `revisor` vit dans `~/curso-http/fig08_01/` ; la section 8.15 apporte tous ses fichiers. Avec Node 24 installé, et depuis ce dossier, une seule ligne vérifie que tout est en place :

```text
$ cd ~/curso-http/fig08_01
$ node matriz23.ts
```

La matrice démarre elle-même le laboratoire et le `revisor`, donc tu n'as pas besoin d'ouvrir de terminaux à part. Ce qu'il lui faut, en revanche, c'est que les ports 18080, 18081 et 18082 soient libres. Si l'un d'eux est occupé, la matrice le dit et sort avec `2` sans rien mesurer ; la cause la plus courante est un `revisor` d'une leçon précédente que tu as laissé ouvert : arrête ce programme avec `Ctrl+C` et recommence. La section 8.7 exécute la matrice et lit sa sortie ligne par ligne.

### 8.2 Un contrat qu'on peut vérifier

#### 8.2.1 Ce qui est promis dans une réponse

Avant d'ouvrir le document, il convient de compter ce que promet une réponse, parce que le document doit tout dire et que le test doit tout vérifier. Une réponse HTTP promet quatre choses :

1. **Le code d'état.** C'est la première chose que lit n'importe quelle machine sur le chemin. C'est ce que la Leçon 0 a appelé « le code commande ».
2. **Les en-têtes que ce code impose ou que la conception a décidés.** Un `405` oblige à envoyer `Allow` (RFC 9110, section 15.5.6 : « The origin server MUST generate an Allow header field in a 405 response »). Un `401` porte `WWW-Authenticate`. Un `201` porte `Location` et, dans cette API, `ETag`. Un `429` ou un `503` portent `Retry-After`, que la section 15.6.4 du même RFC permet dans le `503` avec un « MAY ». Cette différence compte : ce que le RFC laisse facultatif, cette API a décidé de l'envoyer dans chaque réponse qui le permet, et elle le promet dans son document.
3. **Le type de contenu.** Une erreur est `application/problem+json` ; un succès avec corps est `application/json` ; un `204` et un `304` n'ont pas de corps. Le type de contenu est ce qui dit à un programme comment lire ce qui suit.
4. **La forme du corps.** Dans un Problem Details, les cinq membres (`type`, `title`, `status`, `detail`, `instance`) et, selon le type, des extensions comme `errors` ou `existente`.

La scène du début a rompu deux des quatre (l'en-tête et le type de contenu) et laissé intacte la première, qui était la seule que quelqu'un vérifiait. C'est un schéma courant : on teste ce qui est facile à tester, et le code d'état est ce qu'il y a de plus facile. Une vérification complète doit monter du facile à ce qui compte.

#### 8.2.2 Les trois endroits où peut se trouver le mensonge

Si le document, le serveur et le test sont trois choses distinctes, il y a trois façons pour qu'une promesse se rompe sans que personne ne le voie.

- **Le serveur change et le document non.** C'est la scène du début. L'API fait quelque chose de différent de ce que dit le document. Celui qui a lu le document et écrit son client à partir de lui se retrouve avec un programme qui fonctionne contre une API qui n'existe plus.
- **Le document dit quelque chose que le serveur n'a jamais fait.** C'est le cas le moins commenté et le plus courant dans les documents écrits à la main : on documente ce qu'on pensait faire, ou ce qu'on a fait dans une autre branche, ou ce qu'on a copié d'une autre API. Le serveur ne renvoie jamais ce `429` ou cet en-tête. Celui qui fait confiance au document écrit du code pour un cas qui n'existe pas et n'écrit pas celui qui existe.
- **Le test ne regarde pas ce qui compte.** Un test au vert dit que ce qu'il a regardé est correct. Il ne dit rien de ce qu'il n'a pas regardé, et la section 8.14 (point 2) et l'exercice 2 provoquent ce cas avec un exemple mesuré : la matrice qui existe déjà, avec un serveur auquel il manque l'un des cinq membres de toutes les erreurs, donne 40 sur 41 et ne s'en aperçoit presque pas.

C'est pourquoi cette leçon ne se contente pas d'écrire le document. Elle l'écrit, le compare au serveur, puis **défait** le serveur et le document volontairement, pour voir que la comparaison passe au rouge. Une vérification qu'on n'a jamais vue échouer ne démontre rien : elle donnerait le vert même si elle était cassée.

#### 8.2.3 Pourquoi OpenAPI

Pour qu'un programme compare, le document doit être dans un format structuré. Le format le plus répandu pour décrire des API HTTP est **OpenAPI**, une spécification publique de l'OpenAPI Initiative. La version qu'utilise le cours est la **3.1.1**, publiée le 24 octobre 2024 ([spec.openapis.org](https://spec.openapis.org/oas/v3.1.1.html)). Il existe aussi le correctif **3.1.2** et la ligne **3.2** (3.2.0 et 3.2.1), qui figurent sur [la page des versions](https://spec.openapis.org/oas/). Le cours reste sur la 3.1.1 parce que toutes ses citations de section et toutes ses sorties ont été prises contre elle ; on n'a pas vérifié quels outils comprennent déjà la 3.2, et mélanger les versions dans une leçon qui cite des numéros de section serait une source d'erreurs. Si tu commences un nouveau document, regarde d'abord laquelle des trois ton outil comprend. Un document OpenAPI peut s'écrire en JSON ou en YAML, et le cours utilise JSON parce que Node le lit sans aucune dépendance.

La version 3.1 a apporté un changement qui se voit dans le document du `revisor` : elle aligne le schéma de données sur **JSON Schema 2020-12**. La section 4.8.24 de la spécification dit que l'objet de schéma d'OpenAPI est un sur-ensemble de cette version de JSON Schema. En pratique, quand un champ peut être nul, on n'écrit plus `nullable: true` comme en 3.0, mais une liste de types : `"type": ["object", "null"]`. Tu le verras dans le schéma `Resultado`, qui est `null` tant qu'une vérification est en attente ([l'article du blog d'OpenAPI sur le passage de la 3.0 à la 3.1](https://www.openapis.org/blog/2021/02/16/migrating-from-openapi-3-0-to-3-1-0) raconte ce changement et d'autres).

### 8.3 OpenAPI en cinq pièces

Un document OpenAPI de 1 191 lignes fait peur, mais il se lit comme un livre en cinq chapitres. Ce qui suit les parcourt avec le `openapi.json` du `revisor` ouvert à côté ; les citations et les numéros de section viennent de la spécification 3.1.1.

#### 8.3.1 Pièce 1 : `openapi` et `info`

Le document commence par quatre champs qui se lisent d'un coup d'œil (`openapi`, `info`, `servers` et `security`) :

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

Cette dernière ligne ouvre la pièce 4, que nous voyons en 8.3.4. Ce qui précède, ce sont les pièces 1, 2 et 3.

`openapi` dit **quelle version de la spécification** suit le document : `3.1.1`. C'est la première chose que lit n'importe quel outil, parce que de cela dépend la façon d'interpréter le reste.

`info` décrit **le document**, et il y a ici un piège qui mérite une ligne à lui. Le champ `info.version` sonne comme « la version de l'API », et ce n'est pas le cas : la section 4.8.2.1 de la spécification le définit comme la version *du document OpenAPI* (qui est distincte de la version de la spécification), et la section 4.8.1.1 précise qu'il n'a aucun rapport avec le champ `openapi`. Le `revisor` a une API en vigueur (celle de la racine, `/servicios`), une version 1 dépréciée et une version 0 retirée ; si `info.version` était « la version de l'API », laquelle des trois serait-ce ? C'est pourquoi la `description` du document le dit en toutes lettres : `info.version` est la version de *ce document*. C'est le genre de précision qui épargne une discussion d'une demi-heure avec celui qui le lit pour la première fois.

`license` dit sous quelle licence le document est publié. Celle qu'utilise le cours est CC BY-SA 4.0, et le champ `identifier` utilise l'identifiant SPDX, `CC-BY-SA-4.0`.

#### 8.3.2 Pièce 2 : `servers`

```json
"servers": [{ "url": "http://127.0.0.1:18080" }]
```

C'est la liste des adresses où vit l'API. Si le champ est absent, la spécification dit (section 4.8.1.1) que la valeur par défaut est un serveur avec l'`url` `/`, c'est-à-dire le même endroit d'où le document est servi. Le `revisor` l'écrit en entier parce que, dans le cours, le document voyage dans un fichier et n'est servi depuis nulle part.

Remarque ce qu'il **n'y a pas** dans cette liste : aucune adresse interne d'une entreprise ni nom de machine. Un document OpenAPI finit presque toujours publié ; tout ce que tu écris dans `servers`, n'importe qui va le lire. Pour le cours, c'est `127.0.0.1:18080`, qui n'est la machine de personne.

#### 8.3.3 Pièce 3 : `security` et `securitySchemes`

La liste `security` ci-dessus dit que, sauf si une opération dit autre chose, toutes demandent un schéma appelé `credencial`. Ce nom se définit plus bas, dans `components` :

```json
    "securitySchemes": {
      "credencial": {
        "type": "http",
        "scheme": "bearer"
      }
    },
```

Ce sont trois lignes très denses : le schéma est de type `http`, et son schéma (`scheme`) est `bearer`, celui qu'utilise le `revisor` avec `Authorization: Bearer lectura-a`. Pourquoi ne documente-t-on pas `Authorization` comme un paramètre d'en-tête, comme on le fait pour `Idempotency-Key` ? Parce que la spécification n'en tient pas compte : la section 4.8.12.2.1 dit que, si un paramètre est dans l'en-tête et s'appelle `Accept`, `Content-Type` ou `Authorization`, la définition est ignorée. Ces trois en-têtes ont leur propre mécanisme, et celui de l'identifiant est celui-ci.

Il y a des routes qui ne demandent pas d'identifiant : les anciennes redirections (`/viejo/servicios`, `/api/servicios`) et la version retirée (`/v0`). On écrit `"security": []` dans l'opération pour celles-là. Une liste vide veut dire « aucun », et c'est écrit ainsi dans la spécification (section 4.8.10.1) : « To remove a top-level security declaration, an empty array can be used. » C'est la façon de raconter, dans le document, ce que la Leçon 2 a raconté en une phrase : la route et la méthode passent avant l'identifiant.

#### 8.3.4 Pièce 4 : `paths`

Voici le corps du document. `paths` est un objet avec une entrée par **route** ; chaque route a une entrée par **méthode** (la spécification en admet huit : `get`, `put`, `post`, `delete`, `options`, `head`, `patch` et `trace`, à la section 4.8.9.1), et chaque méthode décrit une **opération**. Le `revisor` a douze routes et dix-sept opérations. En voici une complète, la plus courte parmi celles qui ont des erreurs, celle qui retire un service :

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

Elle se lit de haut en bas :

- `summary` : une phrase pour celui qui lit le document. Aucune machine ne s'en sert pour décider quoi que ce soit.
- `responses` : la carte de ce que cette opération peut répondre, avec le **code comme clé**. Les clés sont entre guillemets parce qu'en JSON toute clé est un texte, et la spécification (section 4.8.16.2) le dit ainsi : on peut utiliser n'importe quel code comme nom, et une seule propriété par code. L'objet doit contenir au moins une réponse (section 4.8.16 : « MUST contain at least one response code »).
- `"204"` : la seule réponse de succès. Une réponse *doit* avoir une `description` ; c'est le seul champ obligatoire d'une réponse (section 4.8.17.1), et c'est pourquoi même le `204`, qui ne renvoie pas de corps, en porte une.
- Le reste des réponses sont des `{ "$ref": "…" }`, qui s'expliquent en 8.4. Pour l'instant, il suffit de savoir que chacune pointe vers un endroit de `components` où elle est écrite une seule fois.

Cette opération ne dit rien de sa route. Le paramètre `{id}` est dans l'entrée de la route, un niveau plus haut, parce que `GET`, `PUT` et `DELETE` le partagent :

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

Le paramètre `id` est `in: path`, il est obligatoire et c'est un entier supérieur ou égal à 1. La spécification admet quatre emplacements pour un paramètre (`query`, `header`, `path` et `cookie`, à la section 4.8.12.2.1) ; le `revisor` utilise `path` pour l'`id` et `header` pour `If-Match`, `If-None-Match` et `Idempotency-Key`.

#### 8.3.5 Pièce 5 : `components`

C'est l'entrepôt des pièces réutilisées. Il comporte cinq tiroirs dans ce document : `securitySchemes` (tu l'as déjà vu), `parameters` (la clé `Idempotency-Key`), `headers` (neuf en-têtes avec leur description), `responses` (dix-huit réponses d'erreur réutilisables) et `schemas` (les corps). Une pièce s'utilise depuis n'importe quel point du document avec une **référence** : un objet `{ "$ref": "#/components/responses/E401" }`. Le texte après le dièse est le chemin à l'intérieur du même document : `components`, puis `responses`, puis `E401`.

Pourquoi la ranger là au lieu de l'écrire là où on l'utilise ? Parce que le document du `revisor` a dix-sept opérations et **79 références vers les dix-huit réponses d'erreur**. Si chacune était écrite en entier, le `401` apparaîtrait 12 fois avec son en-tête `WWW-Authenticate`, et il suffirait que quelqu'un en corrige 11 sur 12 pour que le document se contredise lui-même. Avec la référence, le `401` se corrige une seule fois. C'est le même argument que la Leçon 5 : le catalogue de `problemas.ts` est une seule table, pas vingt-quatre phrases réparties.

> **Une subtilité des références.** Dans la version 3.1, un objet de référence peut aussi porter un `summary` et une `description` qui **remplacent**, par défaut, ceux de la pièce référencée (section 4.8.23.1). Le `revisor` ne s'en sert pas : toutes ses références sont de simples `$ref`, de sorte que ce que dit la réponse réutilisable est ce que lit n'importe qui.

### 8.4 Documenter chaque erreur

#### 8.4.1 Une réponse réutilisable complète

Voici la réponse du `401`, telle qu'elle vit dans le document :

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

Elle a trois parties, et les trois sont des promesses que la matrice va vérifier.

La **`description`** raconte quand cela arrive et dit le `type` qu'elle porte. C'est du texte pour des personnes, et c'est la seule partie où le document nomme le `type` (plus à ce sujet en 8.5).

Le **`content`** est une carte dont les clés sont des types de contenu. La clé est `application/problem+json`, et non `application/json`, et c'est exactement la promesse qu'a rompue le « nettoyage » de la scène du début. Dessous, le `schema` pointe vers le schéma `Problema` (tu le vois en 8.4.3).

Et les **`headers`** disent quels en-têtes accompagnent cette réponse. Il y a ici un piège classique, que la spécification nomme : si une réponse définit un en-tête appelé `Content-Type`, cette définition est **ignorée** (section 4.8.17). Le type de contenu ne se documente pas comme un en-tête, il se documente comme la clé de `content`. C'est pourquoi, dans le `401`, seul apparaît `WWW-Authenticate`, qui est celui qu'impose le code, et le type de contenu se trouve ailleurs.

#### 8.4.2 Les en-têtes que chaque code impose ou promet

Le document du `revisor` déclare des en-têtes dans six des dix-huit réponses. Le tableau montre lesquels et d'où vient chacun :

| Réponse | En-tête | Qui l'exige |
|---|---|---|
| `E401` (`401`) | `WWW-Authenticate` | le RFC 9110, section 15.5.2 (« MUST send a WWW-Authenticate header field »), et le schéma Bearer du RFC 6750 ; la Leçon 2 : le défi d'identification |
| `E405` (`405`) | `Allow` | le RFC 9110, section 15.5.6 : « MUST generate an Allow header field » |
| `E415` (`415`) | `Accept` | la Leçon 2 : quels types sont admis |
| `E429` et `E429Salud` (`429`) | `Retry-After` | la Leçon 4 : combien de temps attendre |
| `E503` (`503`) | `Retry-After` | le RFC 9110, section 15.6.4 : le serveur « MAY » l'envoyer, et cette API a décidé de l'envoyer |

Remarque la différence entre les deux dernières lignes et les précédentes. Le `405` **impose** son en-tête : sans `Allow`, la réponse enfreint le RFC. Le `503` ne fait que le **permettre** : une autre API pourrait répondre `503` sans `Retry-After` et rester conforme au RFC. Mais **cette** API, celle du `revisor`, l'envoie dans chaque `503`, et c'est une promesse propre que le document écrit et que celui qui l'intègre va utiliser pour bien attendre. La scène du début a rompu justement une promesse propre, pas une promesse du RFC ; c'est pourquoi la matrice vérifie les deux sortes avec la même rigueur.

#### 8.4.3 Le schéma `Problema`

Le corps de toutes les erreurs est un Problem Details (Leçon 5), et il s'écrit une seule fois :

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

Ce sont les cinq membres que **cette API** promet dans chaque erreur (`required`). Il convient de le dire avec précaution : le RFC 9457 (section 3.1) n'exige pas les cinq, et `type` vaut `about:blank` s'il manque. Les demander tous est une promesse plus stricte que celle du RFC, et c'est pourquoi le document l'écrit et la matrice la vérifie. Vient ensuite la liste des `properties`, qui inclut les cinq plus les deux extensions que le catalogue utilise : `errors` (les lignes du `422`, chacune avec son `pointer`) et `existente` (la route du service qui existe déjà, dans le `409` de nom répété). Et il se ferme sur une ligne qui ressemble à un oubli et qui est une décision : `"additionalProperties": true`. Le RFC 9457 permet d'ajouter des membres d'extension à un Problem Details ; un schéma qui les interdirait dirait quelque chose de faux sur l'API dès qu'un nouveau type de problème en ajouterait un. Les laisser ouverts est honnête : le schéma liste ceux qui sont utilisés aujourd'hui sans fermer la porte à ceux de demain.

Le type de contenu `application/problem+json` est enregistré auprès de l'IANA avec le RFC 9457 comme référence ([registre](https://www.iana.org/assignments/media-types/application/problem+json)) ; c'est la clé de `content` dans chaque réponse d'erreur.

#### 8.4.4 Où ranger ce qui n'est pas une erreur : succès, corps vides et le 405 de PATCH

Les succès se documentent avec le même soin que les erreurs, parce qu'un client construit aussi des choses à partir d'eux. Le `201` de `POST /servicios` déclare ses deux en-têtes, `Location` et `ETag`, et le schéma `Servicio`. Le `304` et le `204` déclarent leur `description` et aucun `content`, et cette absence est une promesse : ils n'apportent pas de corps, et la matrice le vérifie en demandant si le corps est arrivé vide.

Il reste un cas que la spécification ne laisse pas écrire comme on le voudrait : le `405` de `PATCH`. Aucune route du `revisor` n'admet `PATCH`, et OpenAPI décrit des **opérations qui existent** ; déclarer `patch` sur une route pour documenter qu'il n'est pas admis ferait dire le contraire au document (qu'il y a un `PATCH`). La solution du document est de mettre le `405` dans les opérations qui existent (`GET`, `PUT` et `DELETE` de `/servicios/{id}`) et d'y dire que toute autre méthode reçoit cette réponse, avec son en-tête `Allow`. La matrice utilise l'opération `GET` de cette route pour le scénario du `405` (elle le déclare dans le champ `operacion`, section 8.6), et l'exercice 3 te le fait vérifier.

#### 8.4.5 L'en-tête qui n'est pas un standard

`Idempotency-Key` se documente comme un paramètre réutilisable :

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

La `description` fait ce que la Leçon 6 avait dit que cette leçon ferait : elle avertit que c'est un schéma propre à l'API et **non un standard**, et pourquoi. Le brouillon de l'IETF sur lequel il s'appuie, `draft-ietf-httpapi-idempotency-key-header-07`, a expiré le 18 avril 2026 sans être publié comme RFC. `required: false` est l'autre moitié de la promesse : celui qui ne l'envoie pas est quand même servi, comme avant la Leçon 6. Un document qui dirait simplement `Idempotency-Key` sans l'avertissement promettrait, sans le vouloir, que n'importe quelle autre API la comprend de la même façon.

### 8.5 Le catalogue de types de problème, croisé avec le document

La Leçon 5 avait promis que le catalogue de types pouvait être « lu, révisé et documenté en une seule fois ». Il existe une façon peu coûteuse de vérifier que le document tient parole : prendre le catalogue (`CATALOGO` dans `problemas.ts`, avec 24 types depuis que la Leçon 6 en a ajouté deux) et, pour chacun, poser au document deux questions : une opération déclare-t-elle son code ? Le document nomme-t-il son `type` ? C'est ce que fait `fig08_02.ts`. Il n'a besoin d'aucun serveur : il lit deux fichiers.

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

Lis-le par blocs :

- **Les lignes de lecture.** `import { CATALOGO }` apporte la table du serveur ; `readFileSync` lit le document *deux fois*, comme texte (pour chercher des noms) et déjà converti en objet (pour parcourir les codes). C'est la même information vue sous deux angles, à dessein.
- **`documentados`** est l'ensemble de tous les codes que déclare une opération. Les trois `for` imbriqués parcourent les routes, les opérations et les clés de chaque `responses`.
- **La boucle principale** parcourt les 24 entrées du catalogue. Pour chacune, elle calcule `nombre`, qui est la dernière partie du `type` (`servicio-inexistente`), sauf avec `about:blank`, qui n'a pas de nom propre : c'est le même pour toutes ces erreurs.
- **La lacune** est comptée si le code manque, ou s'il y a un nom et que le texte du document ne le contient pas.
- **À la fin**, le code de sortie vaut `0` seulement s'il n'y a pas de lacunes. Cela permet de l'utiliser dans un script ou dans une étape d'intégration continue.

Exécute-le depuis le dossier qui contient `fig08_01/` :

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

Dans aucune des lignes n'apparaît un **NO**, sauf une : `revision-inexistente`, et ce n'est pas une panne du programme : la lacune existe. Pour la voir de tes yeux, demande au serveur ce que le document promet pour cette route, et compare-le avec ce qui se passe réellement sur la route voisine :

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

Compare les deux réponses. `GET /revisiones/99` répond un `404` dont le `type` est `revision-inexistente`. `GET /servicios/99` répond un autre `404`, avec le `type` `servicio-inexistente`. Mais le document a **une seule** réponse `404` pour les deux routes, `E404`, et sa `description` dit « type servicio-inexistente ou about:blank ». Pour la route des vérifications, cette phrase est fausse : celui qui lit le document attendra un `type` que cette route ne renvoie jamais, et ne saura pas que celui qui existe existe.

Pourquoi la matrice ne l'a-t-elle pas vu ? Parce que le scénario du `404` demande un service qui n'existe pas (`/servicios/99`) et vérifie seulement que le `404` est déclaré dans cette opération. Personne n'a demandé à `/revisiones/{id}` son `type`. C'est une leçon générale : **une vérification qui ne regarde pas un cas ne sait rien de ce cas**, et le croisement de cette section a trouvé ce que la matrice, par conception, ne regarde pas. Le corriger est l'exercice 1.

> **Les trois angles morts de ce croisement.** Premièrement, il cherche le nom *n'importe où* dans le texte du document : si `revision-inexistente` apparaissait dans la description d'une autre route, le croisement dirait « oui » même si `/revisiones/{id}` restait faux. Deuxièmement, pour les types avec `about:blank`, il ne vérifie rien sur leur nom, parce qu'ils n'en ont pas. Troisièmement, il ne vérifie pas que le `status` du catalogue coïncide avec la route où il est documenté. C'est un filet de sécurité peu coûteux, pas une preuve complète ; la matrice de la section 8.6 est celle qui regarde les vraies réponses.

### 8.6 La matrice de 23 scénarios : comment elle est faite

`matriz23.ts` fait environ 680 lignes (`wc -l` donne 676), et une part importante en est faite de données, pas de logique. C'est la première décision de conception et elle vaut d'être vue avant le code : les 23 scénarios ne sont pas 23 fonctions, ce sont 23 **lignes d'une table**, et une seule fonction les parcourt. Ajouter un scénario, c'est ajouter une ligne ; changer ce qui est vérifié, c'est changer une fonction, pas 23.

#### 8.6.1 Un scénario est une donnée

Chaque ligne a la forme de ce type :

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

Champ par champ :

- **`codigo`** et **`nombre`** : le code attendu et une phrase pour la ligne de la sortie.
- **`operacion`** : la méthode et la route **telles que les écrit `openapi.json`**. Ce ne sont pas celles de la requête : la requête peut être `GET /servicios/99` et l'opération `["get", "/servicios/{id}"]`, parce que dans le document la route porte le paramètre entre accolades. Grâce à ce champ, la matrice sait où chercher dans le document si le code est déclaré.
- **`antes`** (facultatif) : les requêtes à faire **avant** celle qu'on mesure, pour laisser le serveur dans l'état où le code se produit. Pour un `429`, il faut trois vérifications préalables ; pour un `503`, activer la maintenance.
- **`peticion`** : celle qu'on mesure. Une méthode, une route, des en-têtes et un corps.
- **`cabeceras`** : celles que la réponse **doit** porter. C'est une liste de noms, et la comparaison ne distingue pas les majuscules (les en-têtes HTTP ne les distinguent pas).
- **`tipo`** : le type de contenu attendu, ou `null` s'il ne doit pas y avoir de corps.
- **`type`** : pour les erreurs, le `type` du Problem Details.
- **`revisarCuerpo`** : une fonction facultative pour ce qui est propre à ce scénario, comme « l'extension `existente` pointe vers `/servicios/2` ».

Deux lignes, pour les voir à l'œuvre. Celle du `429` :

```ts
  { codigo: 429, nombre: "demasiadas revisiones", operacion: ["post", "/servicios/{id}/revisiones"],
    antes: [1, 2, 3].map(() => ({ metodo: "POST", ruta: "/servicios/2/revisiones", cabeceras: ESCRIBE })),
    peticion: { metodo: "POST", ruta: "/servicios/2/revisiones", cabeceras: ESCRIBE },
    cabeceras: ["retry-after"], tipo: "application/problem+json", type: PROBLEMA + "demasiadas-revisiones" },
```

Trois vérifications préalables, et la quatrième est celle qu'on mesure. Elle attend l'en-tête `retry-after`, le type de contenu `application/problem+json` et le `type` `demasiadas-revisiones`. Et celle de la maintenance :

```ts
  { codigo: 503, nombre: "mantenimiento", operacion: ["get", "/servicios"],
    antes: [{ metodo: "PUT", ruta: "/mantenimiento", cabeceras: { Authorization: "Bearer admin", ...JSON_ }, cuerpo: '{"activo":true}' }],
    peticion: { metodo: "GET", ruta: "/servicios", cabeceras: LEE }, cabeceras: ["retry-after"], tipo: "application/problem+json", type: PROBLEMA + "en-mantenimiento" },
```

Avant de demander la liste, elle active la maintenance avec un `PUT /mantenimiento` fait par `admin`. Remarque que l'`operacion` de ce scénario est `["get", "/servicios"]` et non `/mantenimiento` : le `503` se documente dans les opérations qui *peuvent le renvoyer*, et la matrice cherche le code là où un client le verrait.

#### 8.6.2 L'ordre compte, et il est écrit

Les scénarios partagent un seul serveur, qui garde son état en mémoire, donc l'ordre dans lequel ils s'exécutent fait partie du test. La liste de la matrice respecte quatre dépendances, et il vaut mieux les connaître parce que ce sont elles qui se cassent en premier quand quelqu'un réordonne :

- Le **`201`** crée un service qui reçoit l'id 7 (ceux du démarrage sont au nombre de six). Le **`204`** le retire, puis le **`410`** le redemande et constate qu'il a été retiré. Si le `410` s'exécutait avant le `204`, il donnerait `200`.
- Le **`500`** utilise le service 4, celui qui n'a pas de vérifications terminées : c'est le défaut volontaire de la Leçon 4, et il vit jusqu'à cette leçon précisément pour avoir un `500` à provoquer.
- Le **`503`** active la maintenance dans son `antes`, et le **`504`** la désactive dans le sien. Si personne ne la désactivait, tout ce qui suit donnerait `503`.
- Le **`304`** a besoin de l'`ETag` en vigueur du service 1, qui change à chaque démarrage. La matrice la lit **une fois au début**, avant le premier scénario, et la garde dans `SIN_CAMBIOS`.

#### 8.6.3 La fonction qui vérifie

La fonction `comprobar` reçoit un scénario et renvoie une **liste** de pannes ; la liste vide signifie qu'il est passé. La voici en entier :

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

Suis les lignes dans l'ordre où elles s'exécutent :

1. **Les requêtes préalables.** Elles sont envoyées et leur corps est écarté avec `.text()`, parce qu'une réponse qu'on ne lit pas laisse la connexion occupée.
2. **La requête mesurée.** Elle est envoyée avec `enviar`, qui utilise `fetch` avec `redirect: "manual"`. Cette option compte : un `301` ou un `308` doit se voir comme `301` ou `308`, et non comme la réponse de la route où `fetch` serait arrivé tout seul. Pour vérifier une redirection, il ne faut pas la suivre.
3. **Le code.** S'il n'est pas celui attendu, une panne est ajoutée.
4. **Les en-têtes.** Chaque nom de la liste doit figurer dans la réponse.
5. **Le type de contenu et le corps.** Si le scénario n'attend pas de corps, le texte doit arriver vide. S'il en attend un, le type doit coïncider ; et ce n'est que s'il coïncide qu'on tente de lire le corps comme du JSON. Si le scénario est une erreur, on vérifie trois membres du Problem Details : `type`, `status` égal au code et `title` de type texte.
6. **La vérification propre au scénario**, s'il en a une.
7. **Les fuites**, seulement dans les `5xx`. Elles sont expliquées plus bas.
8. **La documentation.** Si le document ne déclare pas ce code dans cette opération, il y a une panne. C'est la ligne qui relie la matrice à `openapi.json`.

Il y a une décision de structure qu'on ne remarque que lorsque quelque chose échoue : la fonction **rassemble toutes les pannes** et ne s'arrête pas à la première. Avec le « nettoyage » de la scène, le `503` échoue pour deux raisons (il manque `retry-after` et le type est `application/json`) ; un test qui s'arrêterait à la première en dirait une, celui qui la corrige verra l'autre à l'exécution suivante et perdra un tour de plus. C'est la même politique que le `422` de la Leçon 3, qui rassemble toutes les pannes du corps.

#### 8.6.4 Les fuites

Les erreurs du serveur sont celles qui ont le plus tendance à en dire trop. Un `500` mal géré peut renvoyer la pile de l'exception, et la pile contient des chemins de fichiers, des noms de fonctions et parfois des données. La Leçon 4 a appris à ne dire, dans un `5xx`, qu'une référence ; la matrice le surveille avec une liste de motifs qui ne devraient pas apparaître dans le corps d'un `5xx` :

```ts
const FUGAS = [/\bat \S+ \(/, /file:\/\//, /\/(home|Users)\//, /node:internal/, /\bSELECT\b.+\bFROM\b/i, /Bearer \S+/, /TypeError|ReferenceError/];
```

Lis-les un par un :

| Motif | Ce qu'il attrape |
|---|---|
| `\bat \S+ \(` | une ligne de pile JavaScript : `at nombre (archivo:línea)` |
| `file://` | l'adresse d'un fichier, comme celles que Node imprime dans les piles |
| `\/(home\|Users)\/` | un dossier d'utilisateur d'une vraie machine |
| `node:internal` | une trame interne de Node |
| `\bSELECT\b.+\bFROM\b` | une requête SQL |
| `Bearer \S+` | un identifiant |
| `TypeError\|ReferenceError` | le nom d'une exception JavaScript |

La liste n'est pas exhaustive, et ne peut pas l'être : c'est un ensemble de signaux de ce qu'on a déjà vu, pas une garantie qu'il n'y en a pas d'autres. Elle couvre les plus courants de cette classe de serveur. Elle ne s'applique **qu'aux `5xx`** parce que c'est là que l'imprévu se glisse ; un `404` ou un `422` sont écrits par le gestionnaire central avec des phrases du catalogue.

#### 8.6.5 Démarrer, mesurer et arrêter

La dernière chose que fait le programme est de démarrer ce qu'il va mesurer et de l'arrêter, quoi qu'il arrive :

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

Avant de démarrer quoi que ce soit, la matrice vérifie que les trois ports sont libres : si l'un d'eux répond, elle dit lequel et sort avec `2`, parce que mesurer contre le programme d'un autre, c'est mesurer ce qui n'est pas à toi (l'exercice « Le serveur resté ouvert » le montre). Les deux `spawn` démarrent le laboratoire et le `revisor` comme processus enfants, avec la même version de Node que celle qui exécute la matrice (`process.execPath`), et `esperarPuerto` (au début du fichier, expliqué en 8.14.1) attend que chacun accepte des connexions au lieu de compter un temps fixe. Si l'un ne répond pas en 10 secondes, le `catch` le dit et l'exécution se termine avec `1` sans résumé. Le `try … finally` est la partie qui rend la matrice honnête : quoi qu'il arrive pendant les vérifications (une exception, une panne, un processus qui n'a pas démarré), le `finally` arrête les deux enfants. Sans lui, une erreur à mi-parcours laisserait deux processus à l'écoute sur les ports 18080 et 18081, et l'exécution suivante échouerait pour une raison qui n'a rien à voir avec ce qu'on mesure.

La dernière ligne compte pour celui qui utilise la matrice dans un script : le programme sort avec `0` s'il n'y a eu aucune panne et avec `1` s'il y en a eu au moins une. C'est ce qui permet de le mettre dans une étape d'intégration continue et que l'étape passe au rouge. Remarque aussi qu'il utilise `process.exitCode` et non `process.exit(…)` : il affecte le code et laisse le programme se terminer tout seul, ce qui permet aux enfants et aux connexions de se fermer calmement.

### 8.7 L'exécuter et la lire

Depuis le dossier `fig08_01/`, avec les ports 18080, 18081 et 18082 libres (le troisième est utilisé par la passerelle d'une des vérifications supplémentaires) :

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

Lis-la par blocs.

**Les sept premières lignes** (`200` à `308`) sont les succès et les redirections. Chacune a passé le même examen que les erreurs, mais sous une autre forme : le `200` et le `201` apportent un corps `application/json` et les en-têtes `etag` (et `location` dans le `201`) ; le `304`, le `204`, le `301` et le `308` n'apportent pas de corps, et la matrice vérifie que le texte arrive vide. Le `301` et le `308` sont des `POST` : c'est le couple de la Leçon 1, avec la même requête et deux redirections qui se comportent différemment chez le client.

**Les seize suivantes** (`400` à `504`) sont les erreurs. Chacune a vérifié `application/problem+json`, le `type` du catalogue et, pour cinq d'entre elles, un en-tête : `www-authenticate` dans le `401`, `allow` dans le `405`, `accept` dans le `415`, `retry-after` dans le `429` et le `503`. Le `403` a une vérification propre qui est déjà apparue à la Leçon 2 : le corps **ne répète pas** l'identifiant `lectura-a`. Et le `500` vérifie que `instance` est un `urn:uuid:…`, la référence que le client peut donner à celui qui exploite le serveur.

**Les dix-huit dernières** ne sont pas des codes. Ce sont des vérifications supplémentaires, et la section 8.8 les explique.

**L'avant-dernière ligne** fait la somme : « 41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales) ». Et la dernière ligne, `(código de salida: 0)`, est celle que lit un script.

Deux détails de lecture. La ligne du SSRF dit `http://localhost:18080/mantenimiento` : la matrice essaie d'enregistrer une URL avec un nom qui se résout vers la machine elle-même, et attend un `422` avec le type `destino-prohibido`. Et le temps : l'exécution dure environ 16 secondes, et une bonne part en est faite d'attentes délibérées : le démarrage, la vérification lente du `504`, les nouvelles tentatives de `alta-segura.ts` et les redémarrages du `revisor`.

### 8.8 Les dix-huit autres vérifications

Une fois que les 23 codes sont au vert, la matrice parcourt dix-huit vérifications de plus. Chacune est née d'un défaut concret que les leçons précédentes ont mesuré en leur temps, et existe pour que ce défaut **ne revienne pas sans que quelqu'un s'en aperçoive**. On les appelle des **régressions** : des tests de quelque chose qui a déjà été corrigé une fois.

| # | Ce qui est vérifié | De quelle leçon cela vient |
|---|---|---|
| 1 | `Idempotency-Key` : la même clé ne duplique pas ; avec un autre corps, `422` | 6 |
| 2 et 3 | SSRF : deux URL (`169.254.169.254` et `localhost`) sont rejetées avec `422 destino-prohibido` | 1 |
| 4 | Un identifiant qui n'existe que dans `Object.prototype` (`constructor`, `__proto__`, `toString`) donne `401` | 2 |
| 5 | Requêtes conditionnelles : `If-None-Match` avec liste, `W/` et `*` donne `304` ; `If-Match` avec `W/` donne `412` ; avec liste ou `*` donne `200` | 1 et 3 |
| 6 | La mise à jour perdue : deux `PUT` en même temps avec le même `If-Match`, `200` et `412` | 3 |
| 7 | L'ordre du `PUT` : `text/plain` donne `415` avec un ancien tag ou sans tag ; si on le retire entre-temps, `410` | 3 |
| 8 | Le schéma `bearer` sans distinction des majuscules, et le défi de `Basic` sans `error="invalid_token"` | 2 |
| 9 | Une méthode héritée (`constructor`, `toString`, `__proto__`) donne `405` | 1 et 2 |
| 10 | Un corps JSON qui n'est pas un objet (`null`, `7`, `"texto"`, `[]`) donne `400`, et le `revisor` reste vivant | 1 |
| 11 | Le plafond de 16 KiB : `413` avec `Content-Length` et par morceaux ; juste au plafond, `400` | 2 |
| 12 | La limite par identifiant : la quatrième consultation en direct, `429` ; un autre identifiant ne la paie pas ; énumérer des ids arrive au `429` | 4 |
| 13 | `Retry-After` strict : `1.5`, `-1` et « 12 30 » sont ignorés ; les trois formes de date donnent la même chose | 4 |
| 14 | SSRF avec douze adresses à usage spécial, rejetées ; une 6to4 avec IPv4 publique, acceptée | 1 |
| 15 | La passerelle retransmet `Content-Length` ; sans `revisor`, elle répond `502` et reste vivante ; `alta-segura.ts` se termine à l'épuisement des tentatives, y compris sans connexion | 6 |
| 16 | `alta-segura.ts` décide : un `4xx` sort avec `1` ; il obéit à `Retry-After` s'il est raisonnable et n'insiste pas s'il demande trop ; il s'interrompt par le temps face à un serveur muet ; le `409` de clé en cours est réessayé et celui de nom répété ne l'est pas | 6 |
| 17 | L'`ETag` après redémarrage du `revisor` : l'ancienne ne coïncide plus | 1 |
| 18 | Le banc d'essai répond le `205` sans corps (RFC 9110, section 15.3.6), avec `Content-Length: 0` (sans lui, le `205` n'a pas de longueur déclarée et se lirait jusqu'à la fermeture de la connexion : RFC 9112, section 6.3) et sans `Transfer-Encoding` (décision du banc : Node enverrait `chunked` avec un corps vide ; le RFC ne l'interdit pas dans le `205`) | 0 |

Trois d'entre elles ont une technique qui vaut la peine d'être vue, parce qu'elles montrent comment on teste quelque chose qu'on ne peut pas provoquer avec une requête normale.

#### 8.8.1 La mise à jour perdue : un corps qui arrive par morceaux

Pour prouver que deux `PUT` simultanés avec le même tag ne s'écrasent pas, il faut faire en sorte que l'un **attende son corps** pendant que l'autre écrit. Un `fetch` normal envoie en-têtes et corps ensemble, donc il n'y a pas d'espace. La solution est un corps livré en deux temps :

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

Le corps de la requête lente est un `ReadableStream`. Il livre **dix caractères tout de suite** (sans cela, `fetch` n'envoie même pas les en-têtes) et le reste quand la promesse `suelto` est tenue. L'option `duplex: "half"` est obligatoire quand le corps est un flux : la spécification de `fetch` l'exige et `"half"` est la valeur utilisée dans Node, et elle signifie que la requête est envoyée en entier avant de lire la réponse. Sans elle, `fetch` rejette avec `TypeError: RequestInit: duplex option is required when sending a body.` (mesuré avec Node 24.14.1). Pendant ce temps, la requête rapide modifie le service avec le même tag. Quand la rapide se termine, on appelle `soltar()`, et la lente finit d'envoyer son corps. Le serveur, qui a comparé le tag au début, le compare de nouveau à l'écriture (Leçon 3), le trouve périmé et répond `412`. Les trois vérifications finales ferment le cas : la rapide donne `200`, la lente donne `412`, et le service reste avec la valeur de la rapide.

Ce test **ne dépend presque pas de la chance**. On pourrait essayer avec deux `fetch` simultanés en espérant qu'ils coïncident, et ce serait un cas qui échoue parfois et parfois non. Ici, la seule attente par horloge est celle de 300 ms qu'on donne au premier morceau pour arriver ; à partir de là, l'ordre est imposé par le programme (`soltar()`), pas par le hasard.

#### 8.8.2 La méthode héritée : frapper à la porte sans serveur

`Object.prototype` a des méthodes aux noms comme `constructor` ou `toString`. Si le point d'entrée du `revisor` cherchait la méthode d'une requête dans un objet ordinaire, `constructor` apparaîtrait comme si c'était une méthode de la route. La correction est de la chercher avec `Object.hasOwn`. Comment le vérifier, si Node répond `400` à une méthode qu'il ne connaît pas avant d'appeler le `revisor` (on peut le voir avec `curl -X constructor`) ? En appelant le point d'entrée **directement**, sans serveur :

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

La fonction importe `atender` de `rutas.ts` et l'appelle avec une requête et une réponse **factices** : deux objets avec seulement ce que lit le point d'entrée. Si celui-ci répond par un `405` (le `statusCode` reçu par `writeHead`), tout va bien ; s'il lève une exception, la promesse de `listo` se résout avec le texte « excepción … ». Avant d'appeler, elle fait taire `console.log`, parce que le point d'entrée écrit chaque requête dans le terminal et qu'ici cela tournerait à l'intérieur de la matrice ; et elle le rétablit à la fin. C'est un test **unitaire** glissé dans une matrice d'intégration, et c'est très bien : l'important est qu'il s'exécute, pas le nom du type de test.

#### 8.8.3 L'ETag après redémarrage : arrêter et relancer

La dernière technique consiste à redémarrer le serveur depuis la matrice elle-même :

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

Elle lit le tag du service 3, qui ne change jamais, tue le `revisor` qu'elle a elle-même démarré, le redémarre, et lui demande le service 3 avec le tag d'avant. Si le `revisor` répétait le tag (`"3-1"` avant et `"3-1"` après), il répondrait `304`, un faux `304` : le client resterait avec une copie d'avant le redémarrage. Avec l'identifiant de démarrage dans le tag (`"3-1-86b39f38"` face à un autre de huit chiffres), il répond `200`. C'est la règle du RFC 9110, section 8.8.1, qui demande qu'un tag fort ne soit pas réutilisé pour une autre représentation.

### 8.9 La même chose, avec `curl`

La matrice TypeScript est celle qu'on exécute à chaque changement, mais la première question de celui qui la lit est souvent : *et ça, écrit à la main, à quoi cela ressemblerait-il ?* `fig08_03.sh` répond à cette question. C'est la même idée de 23 scénarios écrite comme tu la taperais dans un terminal : des requêtes avec `curl`, un type de contenu et un en-tête attendus, un compteur à la fin. Il démarre le laboratoire et le `revisor` de son côté et les arrête par PID à la fin.

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

Cinq idées du script :

- **Le contrôle d'entrée.** Avant de démarrer quoi que ce soit, il tente d'ouvrir une connexion vers chaque port avec `/dev/tcp`, une facilité de `bash`. Si quelqu'un répond, le port est occupé et le script refuse de continuer : mesurer contre le programme d'un autre est un moyen sûr de voir des résultats qui ne sont pas les tiens.
- **`probar`.** C'est la fonction qui fait tout le travail. Elle reçoit le code attendu, un nom, le type de corps (`problema`, `json` ou `nada`), l'en-tête obligatoire (ou un tiret s'il n'y en a pas) et les arguments de `curl`. Elle demande à `curl` de garder les en-têtes dans un fichier (`-D`), de ne pas imprimer le corps (`-o /dev/null`) et d'écrire le code et la taille du corps (`-w '%{http_code} %{size_download}'`). Ensuite, elle compare.
- **`size_download`.** Pour savoir qu'un `204` ou un `304` n'apporte pas de corps, il n'est pas nécessaire de voir le corps : la taille de ce qui a été téléchargé doit être zéro.
- **`trap … EXIT`.** C'est le `finally` du script : il arrête le laboratoire et le `revisor` par PID et supprime le fichier temporaire d'en-têtes, même si le script se termine sur une erreur.
- **Le `sleep 1`.** C'est la même attente fixe que la section 8.14.1 remplace dans la matrice TypeScript ; ici, on la garde par simplicité, et c'est le premier endroit où ce script échouerait sur une machine lente.

Exécute-le depuis le dossier qui contient `fig08_01/` :

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

Vingt-trois sur vingt-trois, et le script sort avec `0`. La version `curl` est honnête sur ce qu'elle vérifie en moins : elle regarde le code, le type de contenu, l'en-tête et, pour les succès sans corps, la taille. Elle ne regarde **pas** le `type` du corps, ni le `status` du corps, ni les fuites, ni que le code soit déclaré dans le document. Elle n'exécute pas non plus les dix-huit supplémentaires. Elle sert à voir le squelette de l'idée et à vérifier un changement rapide sans Node sous la main ; la vérification complète est celle de TypeScript.

### 8.10 Que le test morde

Une vérification qu'on n'a jamais vue échouer ne démontre rien : elle donnera le vert aussi bien si elle fonctionne que si elle est cassée. C'est pourquoi plusieurs vérifications de la matrice ont été testées deux fois, une avec la correction en place et une avec la correction défaite, en notant quel nombre donnait la matrice dans chaque cas (celles de cette section, celle du `405` de l'exercice 3, celle du corps par morceaux de 8.14.1 et celle du démarrage lent de l'exercice 6). Les autres n'ont pas de contrôle négatif conservé, et c'est l'une des choses que la matrice ne promet pas (section 8.14). Ici, tu le fais toi-même avec deux défauts volontaires, l'un dans le serveur et l'autre dans le document. Les deux se trouvent dans le dossier `defectos/`, avec un avertissement sur la première ligne du fichier.

#### 8.10.1 Le serveur « nettoyé »

Le premier défaut est la scène du début. Il modifie un seul fichier, `problemas.ts`, le gestionnaire central d'erreurs. Ce qui change, c'est ceci :

```ts
    // DEFECTO A PROPÓSITO: se quitó Retry-After (una «limpieza» de cabeceras) ...
    ...Object.fromEntries(Object.entries(opciones.cabeceras ?? {}).filter(([nombre]) => nombre.toLowerCase() !== "retry-after")),
    // ... y el tipo de contenido pasó a ser el genérico.
    "Content-Type": "application/json",
```

Ce sont deux changements, chacun raisonnable pris seul. Le premier retire un en-tête qui a paru superflu à quelqu'un. Le second unifie le type de contenu de toutes les erreurs avec celui des succès. Aucun code d'état ne change. Pour le provoquer, copie le dossier, remplace le fichier et exécute la matrice :

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

Lis-la comme le ferait celui qui la voit pour la première fois à 10 h 05. La première chose qui frappe, c'est ce qui n'échoue **pas** : les sept premières lignes (les succès et les redirections) restent au vert, ainsi que toutes les vérifications supplémentaires sauf une. La deuxième, c'est ce qui échoue : **toutes** les erreurs, du `400` au `504`, avec le même message : le type de contenu arrivé est `application/json` alors qu'on attendait `application/problem+json`. Dans le `429` et le `503`, le message porte une phrase de plus, `falta retry-after`, et dans la vérification supplémentaire des `429` par identifiant, elle se répète. Et le `401`, le `405` et le `415` conservent leurs en-têtes (`www-authenticate`, `allow`, `accept`), parce que le défaut n'a retiré que `Retry-After`. Chaque panne dit **quelle promesse a été rompue et dans quel scénario**, et la liste complète compte 17 lignes rouges sur 41 ; le programme sort avec `1`.

Un fait compte plus que le décompte : **aucune ligne ne dit « código »**. Si les tests de la scène du début n'avaient été que des tests de code, cette exécution aurait donné 41 sur 41. La matrice ne regarde pas que le code, et c'est pourquoi elle serait passée au rouge le lundi même où le changement a été versionné.

#### 8.10.2 Le document resté en arrière

Le second défaut vit dans le document. C'est l'autre moitié de la scène : quelqu'un a ajouté le `429` au serveur et ne l'a pas écrit, ou l'a écrit et l'a ensuite retiré. Pour le provoquer, le fichier `defectos/sin-429-documentado/openapi.json` est le document habituel sans le `429` de `POST /servicios/{id}/revisiones` :

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

À la fin de cette sortie se trouve le même document passé par un validateur (Redocly, qu'on installe en 8.11 ; les trois commandes copient chaque document dans le dossier du validateur sous le nom `openapi.json`) ; il est expliqué en 8.11.3. La matrice signale **une** panne, exactement celle qui correspond : `429 demasiadas revisiones: openapi.json no documenta 429 en POST /servicios/{id}/revisiones`. Le serveur continue de faire ce qu'il faisait ; le document a cessé de le dire, et la matrice l'a remarqué parce que le scénario du `429` demande, à la fin de `comprobar`, si le document déclare ce code dans cette opération (section 8.6.3). C'est un résultat net : 40 sur 41, une seule ligne rouge, un seul coupable.

> **Une ligne d'avertissement à l'intérieur d'un JSON.** JSON n'admet pas les commentaires, donc un avertissement sur la première ligne ne peut pas s'écrire comme en TypeScript. Le fichier utilise la manière que la spécification OpenAPI offre pour cela (section 4.9, « Specification Extensions ») : un champ dont le nom commence par `x-` peut porter n'importe quelle valeur, et le document reste valide. C'est pourquoi la première ligne du défaut est `{ "x-defecto": "DEFECTO A PROPÓSITO …",`.

### 8.11 Un document valide n'est pas un document vrai

Le même document auquel tu as retiré le `429` fait une chose intéressante quand on le donne à un validateur OpenAPI. Un **validateur** (en anglais, *linter* quand il donne aussi son avis sur le style) lit le document et dit s'il est bien écrit selon la spécification. Il y en a plusieurs ; le cours utilise **Redocly CLI**, un outil en ligne de commande sous licence MIT, et sa commande `lint` ([documentation](https://redocly.com/docs/cli/commands/lint)). Ce n'est pas une dépendance du `revisor` : on l'installe à part, dans un dossier de travail, et on le jette quand tu as fini.

```text
$ mkdir ~/validador && cd ~/validador
$ npm init -y
$ npm install --no-save @redocly/cli@2.57.0
$ cp ~/curso-http/fig08_01/openapi.json .
```

#### 8.11.1 Le document du `revisor`, validé

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

Lis-la de haut en bas. La ligne du début signale qu'aucune configuration n'a été donnée et que c'est la configuration **recommandée** qui est utilisée, ce qui est la valeur par défaut de la commande. Suivent 26 avertissements (*warnings*), et le verdict : « Woohoo! Your API description is valid. » Autrement dit : zéro erreur. Le document est bien écrit selon la spécification.

Les 26 avertissements ne sont pas des erreurs, et ils se répartissent en trois groupes qu'il faut comprendre :

- **17 de `operation-operationId`.** Chaque opération peut porter un `operationId`, un identifiant unique (la spécification, section 4.8.10.1, dit qu'il doit être unique parmi toutes les opérations du document). Il sert aux outils qui **génèrent du code** à partir du document, pour nommer les fonctions. Le cours ne génère pas de code, donc le document n'en a pas. C'est une décision, et l'avertissement est le validateur qui demande si tu l'as oublié.
- **5 de `operation-2xx-response`.** Cinq opérations ne déclarent aucune réponse `2xx` : les deux anciennes redirections (`GET` et `POST` de `/viejo/servicios` et de `/api/servicios`, quatre) et `GET /v0/servicios` (la version retirée, qui ne répond que `410`). C'est vrai : ces routes n'ont pas de succès. L'avertissement est le validateur qui demande si c'est voulu, et ça l'est.
- **4 de `operation-4xx-response`.** Les quatre redirections ne déclarent aucune réponse `4xx` non plus.

Aucun des 26 n'est une promesse rompue, et c'est pourquoi le document reste tel quel. Mais c'est le genre de décision qui se prend au grand jour, pas en silence : on exécute le validateur, on lit chaque groupe et on décide.

#### 8.11.2 Le contrôle positif : un document qui est bel et bien mal écrit

Un validateur qui dit toujours « valide » ne prouve rien non plus. Pour voir que celui du dessus **mord**, le défaut `documento-roto` comporte deux erreurs d'écriture : une référence à une réponse qui n'existe pas (`E4O1`, avec une lettre O à la place d'un zéro) et un `204` sans sa `description` :

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

Cette fois, oui : **deux erreurs**, et le validateur refuse de le tenir pour bon. La première dit `no-unresolved-refs`, « Can't resolve $ref », à la ligne 38, qui est la référence mal écrite. La seconde dit `struct`, « The field `description` must be present on this level », à la ligne 263, qui est le `204` : la spécification (section 4.8.17.1) exige `description` dans toute réponse. Ce sont toutes deux du genre d'erreur qui se glisse dans un document de plus de mille lignes écrit à la main, et le validateur les attrape sans que tu exécutes aucun serveur.

#### 8.11.3 La conclusion inconfortable

Maintenant le même outil, contre le document de la section 8.10.2, celui qui n'a pas le `429` :

```text
$ npx redocly lint openapi.json --format=stylish
```

Son verdict : « Woohoo! Your API description is valid. », avec 27 avertissements, un de plus que les 26 d'avant. Le nouveau dit `no-unused-components` : « Component: "E429" is never used. » Autrement dit, le validateur **a bien remarqué** quelque chose : la réponse réutilisable `E429` est restée sans aucune opération qui l'utilise. Mais il l'a dit comme un avertissement, pas comme une erreur, et il n'avait aucun moyen de savoir que le serveur renvoie toujours ce `429`. Le document reste valide, et le validateur n'a **pas** vu qu'il mentait.

Ce n'est pas une panne du validateur. Un validateur répond à la question *est-ce bien écrit ?*, et le document sans le `429` est parfaitement bien écrit : il ne mentionne simplement pas un code que le serveur renvoie bel et bien. Pour répondre à *est-ce vrai ?*, il faut comparer le document avec le serveur, et c'est ce que fait la matrice. Les deux outils ne se remplacent pas, ils se complètent :

| Question | Qui y répond | Exemple dans cette leçon |
|---|---|---|
| Est-ce bien écrit ? | le validateur (`redocly lint`) | la référence `E4O1` et le `204` sans `description` |
| Est-ce vrai ? | la matrice (`matriz23.ts`) | le `429` que le serveur renvoie et que le document passe sous silence |
| Est-ce que cela dit tout ? | le croisement du catalogue (`fig08_02.ts`) | `revision-inexistente`, que le document ne mentionne pas |

Une API avec seulement la première ligne a un document élégant et périmé. Une API avec seulement la deuxième a une vérification qui dépend d'un document dont personne ne sait s'il est lisible. Avec les trois, chaque type d'erreur a quelqu'un pour l'attraper.

### 8.12 DNS rebinding : la lacune de la Leçon 1, refermée

La Leçon 1 a laissé une dette notée dans un commentaire de `destinos.ts` : le `revisor` valide la destination avant chaque connexion, et pourtant il reste une fenêtre. Aujourd'hui, elle se referme. Avant de voir comment, il convient de raconter pourquoi cela compte avec deux cas de cette même année.

#### 8.12.1 Deux avis publics

Le 10 juillet 2026 a été publié un avis de sécurité sur `mcp-atlassian`, un serveur MCP open source et tiers (ce n'est pas un produit d'Atlassian) pour connecter des agents d'IA à Jira et Confluence ([GHSA-489g-7rxv-6c8q](https://github.com/advisories/GHSA-489g-7rxv-6c8q)). Ce qui est intéressant, c'est qu'il **avait déjà eu une correction** contre le SSRF ; l'avis traite de la raison pour laquelle cette correction n'a pas suffi. La correction résolvait le nom une fois, pour le vérifier, et la requête suivante réutilisait le nom tel quel ; ainsi, dit l'avis, la requête « re-résout à la connexion, sans fixer l'IP » (notre traduction de : *re-resolves at connect time with no IP pinning*). Un nom contrôlé par l'attaquant peut répondre une adresse publique pendant la vérification et une interne (comme `169.254.169.254`, où les clouds publient les métadonnées de la machine) à la connexion. L'avis précise que le test qui accompagne le rapport ne démontre pas une attaque complète contre un serveur en marche, et que l'exploiter exige de gagner cette course. Il la qualifie de course entre la vérification et l'utilisation (en anglais, *TOCTOU*, *time of check, time of use*) et la version qui la corrige est la 0.22.0.

Presque un mois plus tôt, le 15 juin 2026, un autre avait été publié, avec le même schéma et dans un autre produit : **CVE-2026-53708**, dans une passerelle de serveurs MCP ([avis GHSA-9hgc-g3w5-67cm](https://github.com/advisories/GHSA-9hgc-g3w5-67cm)). Un point d'accès d'administration vérifiait le nom d'une URL en le résolvant, bloquait ce qui est privé, puis **remettait le nom d'origine** au client HTTP, qui le résolvait de nouveau. Un attaquant qui contrôle le DNS peut renvoyer une IP publique pendant la validation et une privée pendant la connexion. Il a été corrigé dans la version 1.0.3 (gravité modérée, CVSS 6.6). L'avis le dit ainsi : le point d'accès valide le nom en le résolvant, et le client HTTP, de son côté, résout de nouveau le nom à la connexion sans que rien ne relie les deux opérations (notre paraphrase de l'avis, qui est en anglais). La recommandation est la même que celle de l'autre avis : fixer l'IP déjà validée dans la connexion.

Une précision de vocabulaire : « DNS rebinding » désigne, dans son sens classique, une attaque depuis le navigateur contre la politique de même origine ; les avis (et OWASP) appellent de la même façon cette course côté serveur, ce qui est le sens qu'il a ici. Les deux ont quelque chose en commun avec le `revisor` de la Leçon 1 : un programme dont le travail est de se connecter à des adresses que quelqu'un d'autre lui a données. Et les deux ont eu le défaut que la Leçon 1 a nommé et laissé ouvert : valider et se connecter sont **deux résolutions**, pas une. Le guide d'OWASP sur le SSRF le dit sans détour : « un second DNS lookup non vérifié entre la validation et la connexion peut contourner ces défenses » (notre traduction) ; et il recommande de se connecter uniquement aux adresses validées, en conservant le nom d'origine pour l'en-tête `Host`, le SNI et la vérification du certificat ([guide d'OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)).

#### 8.12.2 Le mécanisme, de tes propres mains

Avant de lire la défense, fais en sorte que l'attaque se produise, en petit et sans attaquer personne. `fig08_04.ts` simule un DNS qui ment : la **première** fois qu'on l'interroge sur `rebote.ejemplo`, il répond `127.0.0.1` (le laboratoire, qui est autorisé) ; à partir de la **seconde**, il répond `::1`, où écoute un autre serveur qui répond `299` (un code que personne d'autre ne renvoie, pour le reconnaître). On remplace `dns.lookup` et `dns/promises.lookup` par nos propres fonctions qui comptent combien de fois elles sont appelées. Rien de tout cela ne sort de ta machine :

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

Les parties qui comptent :

- **Deux serveurs, deux adresses.** Le « laboratoire » écoute sur `127.0.0.1:18081`, et « l'autre » sur `[::1]:18081`. C'est le même numéro de port sur deux adresses distinctes, ce qui est possible parce qu'une adresse IPv4 et une adresse IPv6 sont des endroits différents.
- **`responder`.** C'est le DNS qui ment : il compte combien de fois on l'appelle et répond une adresse différente selon le numéro de la question.
- **Deux correctifs.** `dnsPromesas.lookup` est utilisé par `destinos.ts` pour valider (la version à promesses), et `dns.lookup` est utilisé par Node en interne quand une connexion demande à un nom son adresse (la version à *callback*). Ce second correctif a deux façons de répondre, parce que `dns.lookup` peut être demandé avec l'option `all` ou sans elle (le manuel de Node, page de `dns` : avec `all`, les arguments du *callback* sont `(err, addresses)` ; sans elle, `(err, address, family)`).
- **`syncBuiltinESMExports()`.** Quand tu importes `{ lookup }` d'un module interne de Node, le nom `lookup` reste fixé à la valeur qu'il avait à ce moment-là. Après avoir remplacé la fonction, il faut synchroniser les noms exportés, sinon `destinos.ts` continuerait d'appeler l'originale.
- **L'`import()` dynamique à la fin** charge `cliente.ts` du dossier passé en argument. D'abord on corrige, ensuite on importe ; l'inverse ne fonctionnerait pas.

Le programme reçoit le dossier du client qu'on veut tester. Pour la première expérience, il faut le client de la Leçon 7, celui qui utilise `fetch`. Il se trouve dans `defectos/con-fetch/` (deux fichiers : `cliente.ts` et `destinos.ts`, avec un avertissement sur la première ligne). Monte un dossier avec les fichiers du `revisor` et remplace ces deux-là :

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

Le premier bloc est l'attaque : le client de la Leçon 7 a interrogé le DNS **deux fois**. La première (pour valider) a obtenu `127.0.0.1`, qui est dans la liste des adresses autorisées ; la seconde (celle que `fetch` a faite en interne en se connectant) a obtenu `::1`, et le client est arrivé au serveur du `299` sans qu'aucune règle de `destinos.ts` ne le voie. Le second bloc est la défense : le client de cette leçon a interrogé **une seule fois**, s'est connecté à ce qu'on lui a répondu et est arrivé au laboratoire, avec un `200`. La même requête, le même nom, le même DNS qui ment : deux clients, deux destinations.

> **C'est une simulation, et elle le dit.** Le DNS qui ment est une fonction à nous ; « l'autre serveur » est un serveur à nous. Un vrai attaquant, de plus, a besoin d'une réponse avec une durée de vie (TTL) très basse et qu'aucun cache (du système d'exploitation ou du résolveur) ne répète la première réponse, ce que la simulation esquive par construction ; et le correctif de `dns.lookup` fonctionne parce que `net.connect` consulte cette fonction à la connexion, ce qui est une hypothèse sur la façon dont Node est fait et non une garantie. Si ton système n'a pas `::1`, change le second serveur en `127.0.0.2` (Linux l'admet comme loopback). Le test démontre que le client de la Leçon 7 **redemande** et que celui de la Leçon 8 **ne le fait pas**, ce qui est ce qu'il faut savoir. Il ne démontre pas qu'un vrai attaquant puisse exploiter le `revisor` : cela dépend de l'endroit où il tourne, du réseau qui l'entoure et de la seconde couche que demandait la Leçon 1 (un réseau qui ne laisse pas atteindre les métadonnées même si le programme essaie).

#### 8.12.3 La défense : se connecter à l'adresse déjà validée

La défense tient en trois petits changements. Le premier est dans `destinos.ts` : `revisarDestino` ne répond plus seulement « oui » ou « non », il répond « oui, et voici les adresses que j'ai vérifiées » :

```ts
// Si se permite, trae las direcciones ya validadas: quien se conecte debe usar una de éstas.
export type Veredicto = { permitido: true; direcciones: string[] } | { permitido: false; motivo: string };
```

Et à la fin de la fonction, au lieu de `return { permitido: true };`, elle renvoie `return { permitido: true, direcciones };`. Celui qui se connecte a maintenant sous la main exactement les adresses qui ont passé la vérification, et aucune autre.

Le deuxième et le troisième sont dans `cliente.ts`. D'abord, une fonction qui **ne résout rien** :

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

`soloA` reçoit une adresse et renvoie une fonction de recherche (*lookup*) qui **répond toujours cette adresse**, sans interroger personne. Le type `LookupFunction` vient de `node:net`. L'option `lookup` de `http.request` et de `net.connect` existe pour cela : selon le manuel de Node, sa valeur par défaut est `dns.lookup()`, et on peut la remplacer par n'importe quelle fonction de même forme. Les deux chemins du `if` ne sont pas un ornement. Depuis Node 20, `net.connect` a l'option `autoSelectFamily` activée par défaut, qui essaie des adresses IPv4 et IPv6 en séquence et, lorsqu'elle est active, passe à `lookup` l'option `all: true` ; dans ce cas, la fonction attend une **liste** d'adresses, pas une seule. C'est pourquoi `soloA` répond des deux manières, selon ce qu'on lui demande.

Ensuite, la fonction qui fait la requête :

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

Trois décisions, dans l'ordre :

- **On lui passe l'objet `URL`, pas une adresse.** `pedirCon(url, opciones, …)` prend le nom de l'URL pour l'en-tête `Host` et, en `https`, pour le **SNI** et la vérification du certificat, et prend de `lookup` **l'endroit où se connecter**. C'est pourquoi le serveur du laboratoire reçoit `Host: rebote.ejemplo:18081` même si la connexion est allée à `127.0.0.1` (tu le vérifieras dans l'exercice 4).
- **`agent: false`.** Le manuel de Node dit qu'avec cette option on utilise un nouvel agent à usage unique, et qu'elle sert « to avoid connection reuse ». Une connexion réutilisée d'un agent partagé pourrait avoir été ouverte avant, vers une autre adresse ; avec `agent: false`, chaque requête ouvre la sienne, vers l'adresse qu'elle vient de valider.
- **`signal`.** C'est l'`AbortSignal` portant la limite de temps. Il annule la requête entière, pas seulement la connexion : c'est ce que faisait auparavant `AbortSignal.timeout` avec `fetch`.

Et le corps de `consultar`, qui boucle la boucle :

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

La séquence compte : **d'abord** on vérifie la destination (`revisarDestino`, qui résout une fois), **ensuite** on arme la limite de temps, et **enfin** on se connecte à `veredicto.direcciones[0]`. Il n'y a pas de troisième résolution. `respuesta.destroy()` coupe la lecture après les en-têtes : le `revisor` ne s'intéresse qu'au code et aux en-têtes, pas au corps. Et la classification des erreurs a changé de forme, pas de fond : avant, elle regardait une exception de `fetch` (`DOMException` avec `TimeoutError`, ou la `cause` avec le `code`) ; maintenant, elle regarde si le signal a été annulé (`tiempo.aborted`) ou le `code` de l'exception de Node. Les cinq issues sont les mêmes.

#### 8.12.4 Ce qui n'a pas changé : le certificat, la redirection et les issues

Trois questions raisonnables, avec réponse mesurée.

**Le certificat est-il toujours vérifié contre le nom ?** Oui, et c'est la raison de passer l'`URL` et non l'IP. On l'a vérifié contre un site public et deux sites de test de la communauté des navigateurs, l'un avec le certificat expiré et l'autre avec un nom qui ne correspond pas (il faut internet) :

```text
$ node --input-type=module -e 'import { consultar } from "./cliente.ts"; console.log(JSON.stringify(await consultar(process.argv[1], 8000)))' https://example.com/
{"tipo":"respuesta","codigo":200,"ms":484,"reintentarEn":null}
$ node --input-type=module -e 'import { consultar } from "./cliente.ts"; console.log(JSON.stringify(await consultar(process.argv[1], 8000)))' https://expired.badssl.com/
{"tipo":"respuesta-invalida","motivo":"certificate has expired"}
$ node --input-type=module -e 'import { consultar } from "./cliente.ts"; console.log(JSON.stringify(await consultar(process.argv[1], 8000)))' https://wrong.host.badssl.com/
{"tipo":"respuesta-invalida","motivo":"Hostname/IP does not match certificate's altnames: Host: wrong.host.badssl.com. is not in the cert's altnames: DNS:*.badssl.com, DNS:badssl.com"}
```

Le premier répond `200`. Les deux autres sont `respuesta-invalida`, avec le motif que donne Node : `certificate has expired` pour l'un, et pour l'autre que le nom du serveur ne figure pas parmi ceux du certificat. Ce que cela prouve, c'est que le nom **continue** d'être comparé au certificat : le client n'a changé que l'endroit où le socket se connecte, pas ce contre quoi on vérifie.

Pour voir ce qui se passerait si, à la place, on substituait le nom par l'IP dans l'URL, `fig08_07.ts` fait exactement cela (il résout le nom, construit `https://<IP>/` et demande la page) :

```text
$ node fig08_07.ts example.com
{"nombre":"example.com","error":"EPROTO"}
$ node fig08_07.ts expired.badssl.com
{"nombre":"expired.badssl.com","error":"CERT_HAS_EXPIRED"}
$ node fig08_07.ts wrong.host.badssl.com
{"nombre":"wrong.host.badssl.com","error":"CERT_HAS_EXPIRED"}
```

Ce n'est pas une alternative : **même le bon site** ne fonctionne pas (`example.com` finit en `EPROTO`, une erreur de la négociation TLS : sans le nom, le serveur ne sait pas quel certificat présenter), et les deux mauvais sites ne donnent pas `200` non plus (tous deux finissent en `CERT_HAS_EXPIRED` : la validité d'un certificat est toujours vérifiée, et sans le nom le serveur offre celui qu'il a par défaut). Autrement dit, se connecter « à l'IP » n'assouplit pas la vérification, il la casse ailleurs et avec un autre message. C'est pourquoi `consultar` passe l'`URL` avec le nom et ne change que l'adresse du socket : on conserve le nom pour l'en-tête `Host`, pour le SNI et pour la vérification du certificat.

**Les redirections sont-elles suivies ?** Non. Une requête vers une destination qui répond `301` renvoie `301`, pas la réponse de l'endroit vers lequel elle pointe. `http.request` ne suit pas les redirections de lui-même, et le `revisor` ne les suit pas non plus : le guide d'OWASP les liste comme une voie pour contourner la validation (une URL autorisée qui redirige vers une URL interdite), et la recommandation est de les désactiver. Auparavant, on y parvenait avec `redirect: "manual"` dans `fetch` ; maintenant, en ne les suivant pas.

**Une issue a-t-elle changé ?** Non. Les cinq types de `Consulta` sont les mêmes, et les codes qui sortent dans la matrice sont les mêmes. La seule chose qui change est le texte interne du `motivo` dans `respuesta-invalida`, qu'aucune réponse du serveur ne montre.

#### 8.12.5 Ce que cette défense ne fait pas

Ce serait une mauvaise habitude de clore une section de sécurité en disant « c'est réglé ». Trois limites, à la vue de tous.

- **Elle se connecte à une seule adresse.** `veredicto.direcciones[0]` est la première de celles que le DNS a vérifiées. Si le nom en a plusieurs et que la première ne répond pas, le `revisor` n'essaie pas la seconde : d'après ce qu'on lit dans le code, un nom dont la première adresse refuse la connexion est compté comme `sin-conexion`, même si la seconde fonctionne. C'est le prix de la fixation de l'adresse ; une version qui essaierait les suivantes devrait appliquer la même vérification à chacune. Le guide d'OWASP le demande ainsi : appliquer la politique de destination aussi aux nouvelles tentatives et aux connexions alternatives.
- **Elle ne remplace pas le réseau.** Un `revisor` exposé à internet devrait tourner sur un réseau sans route vers ce qu'il ne doit pas atteindre. La Leçon 1 l'a dit ; c'est toujours vrai. Cette défense réduit ce qui dépend d'un fichier.
- **Elle ne couvre pas ce qui ne passe pas par `consultar`.** Aujourd'hui, le seul endroit où le `revisor` se connecte est `cliente.ts`. Si demain quelqu'un en ajoute un autre (un avis par e-mail, un téléchargement de fichier), il doit passer par le même point d'entrée, et la matrice de la section 8.6 **ne le sait pas** : elle ne vérifie que les destinations que tu lui indiques.

### 8.13 Les versions de l'API dans le document

La Leçon 3 a montré comment on retire une version sans surprendre personne : des mois d'avertissements et, à la fin, un `410`. Il manquait un endroit où ces avertissements soient écrits pour les machines, et c'est le document. D'abord, ce que le serveur fait vraiment :

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

Voyons ce qui compte dans les trois réponses. `/v1/servicios/1` répond `200` avec trois en-têtes : `Deprecation`, `Sunset` et `Link`. `/v0/servicios` répond `410`, avec le type `version-retirada`. Et la route `PATCH` du dernier bloc, tu la connais déjà de la section 8.4.4.

#### 8.13.1 Ce que disent les trois en-têtes

`Deprecation` est le RFC 9745, publié en mars 2025 dans la voie des standards (*Standards Track*). Sa valeur est une **date** au format des champs structurés de HTTP, un nombre de secondes depuis 1970 précédé d'un arobase : la section 2.1 dit « Deprecation is an Item Structured Header Field; its value MUST be a Date ». La valeur que le `revisor` envoie, `@1782864000`, est le 1er juillet 2026 à 00 h 00 en UTC. Cela veut dire « cette version a été dépréciée à cette date », et la date peut être dans le passé ou dans le futur.

`Sunset` est le RFC 8594, de mai 2019, **informatif**. Sa valeur est une date HTTP ordinaire (`Sun, 31 Jan 2027 00:00:00 GMT`), et elle dit quand on s'attend à ce que la ressource cesse de répondre. Le RFC lui-même dit que celui qui le reçoit doit prendre les dates comme des indices (*hints*), non comme des garanties. La relation entre les deux figure à la section 4 du RFC 9745 : la date de `Sunset` ne doit pas être antérieure à celle de `Deprecation`, et celle de la version 1 du `revisor` (31 janvier 2027) lui est postérieure de sept mois.

`Link` avec `rel="deprecation"` pointe vers la documentation humaine de la dépréciation : le guide de migration. Le RFC 9745 enregistre cette relation et donne un exemple avec le même format que celui qu'utilise le `revisor`.

#### 8.13.2 Comment on dit cela dans OpenAPI

Le document comporte trois endroits où les versions apparaissent :

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

C'est l'opération `GET /v1/servicios`, et elle apporte trois choses :

- **`"deprecated": true`.** C'est un champ de l'opération. La spécification (section 4.8.10.1) dit : « Declares this operation to be deprecated. Consumers SHOULD refrain from usage of the declared operation. » C'est l'avertissement pour les machines : les outils de documentation barrent souvent l'opération, et ceux qui génèrent du code peuvent marquer la fonction comme obsolète.
- **Les trois en-têtes** (`Deprecation`, `Sunset` et `Link`) dans la réponse `200`, référencés depuis `components/headers`, chacun avec sa description et le RFC qui le définit.
- **Le retrait**, `/v0/servicios`, avec `deprecated: true`, `"security": []` (il ne demande pas d'identifiant, parce que le `410` est renvoyé avant de demander qui tu es) et seulement la réponse `410`, la même `E410` qu'utilise le service retiré, parce que le catalogue réutilise le schéma `Problema` avec le `type` propre `version-retirada`.

Et il y a une troisième ligne qui boucle la boucle : dans l'`info` du document, la description dit que `info.version` est la version **du document**, et que l'API en vigueur vit à la racine, avec la v1 dépréciée et la v0 retirée. Sans cette phrase, quelqu'un qui lirait `"version": "1.0.0"` penserait que `/v1` est la version en vigueur.

Un détail de conception qu'il vaut la peine de dire à voix haute : **les versions vivent dans la route** (`/v1/…`, `/v0/…`), et celle en vigueur n'a pas de préfixe. Il existe d'autres façons de versionner une API (par en-tête, par type de contenu) et OpenAPI les décrit toutes ; la route est la plus facile à documenter, parce que chaque version est une entrée de `paths` et que chacune peut être marquée `deprecated` séparément.

### 8.14 Ce que la matrice ne promet pas

Une vérification honnête dit ce qu'elle ne voit pas. Sept choses, avec leur preuve.

**1. Elle ne regarde pas les cas qu'elle n'a pas écrits.** C'est ce qu'a enseigné le croisement de la section 8.5 : `GET /revisiones/{id}` renvoie un `type` que le document ne mentionne pas, et la matrice était au vert parce que son scénario du `404` demande un service, pas une vérification. Chaque route qui n'a pas son scénario est une route que la matrice ne connaît pas.

**2. Elle regarde si les membres sont là, pas si leur forme est correcte.** Elle vérifie `type`, `status` et `title` dans toutes les erreurs ; elle ne vérifie ni `detail` ni `instance`, sauf dans le `500`. L'exercice 2 le mesure : avec un serveur auquel il manque `instance` dans toutes ses erreurs, la matrice actuelle donne **40 sur 41**, et la seule panne est celle du `500` ; l'extension de deux lignes la met à **25 sur 41**.

**3. Elle ne compare pas les corps à leurs schémas.** Le schéma `Servicio` dit qu'un service a `id`, `nombre`, `url` et `limite_ms` ; la matrice regarde que l'`id` soit 1 dans une consultation et que le `nombre` soit `matriz` dans une création, pas que les quatre champs aient le type que dit le schéma. Un serveur qui renverrait `limite_ms` comme texte passerait. Pour combler cela, il faut un validateur de JSON Schema (aucun dans les dépendances du cours), et c'est l'extension naturelle de la matrice.

**4. Elle ne vérifie pas les en-têtes des avis de version.** Le document promet `Deprecation`, `Sunset` et `Link` sur `/v1`, et cette promesse a été vérifiée à la main en 8.13 et dans la Leçon 3 ; la matrice de 23 scénarios n'a pas de scénario pour `/v1`.

**5. Les scénarios partagent un serveur avec état.** L'ordre est écrit (section 8.6.2), et un changement qui réordonne les scénarios peut les casser pour des raisons qui ne sont pas des défauts de l'API.

**6. Le décompte des fuites est une liste de signaux, pas une preuve d'absence.** Elle couvre les piles, les chemins de fichiers, le SQL, les identifiants et les noms d'exceptions JavaScript, et laisse de côté tout ce qu'on n'a pas imaginé.

**7. C'est un test, et les tests aussi échouent sans raison.** Celle-ci mérite une place à part, parce que c'est ce qui use le plus la confiance dans n'importe quelle vérification automatique. Pendant cette leçon, l'une des vérifications de la matrice a échoué parfois sans qu'il y ait aucun défaut, et l'histoire complète (comment on l'a trouvée, comment on l'a mesurée et comment on l'a refermée) se trouve dans la section suivante.

#### 8.14.1 Une vérification qui échoue parfois : comment nous l'avons trouvée, mesurée et refermée

**Comment nous l'avons trouvée.** Pendant la rédaction de cette leçon, la matrice est sortie quelques fois avec le code `1` alors que rien n'était cassé. C'étaient des exécutions de travail, certaines contre des copies avec des défauts volontaires, et leur décompte n'a pas été conservé : c'est pourquoi il n'y a pas ici de chiffre sur le nombre de fois où elle échouait, et tout ce qui suit est ce qui a été mesuré ensuite, avec des programmes et des sorties qui se trouvent dans le dépôt. L'une des vérifications qui ont échoué est celle du corps de plus de 16 KiB (la ligne vient d'une de ces exécutions de travail ; elle n'a pas été enregistrée dans un fichier) :

```text
FALLA cuerpo de más de 16 KiB: 413 (con Content-Length y por partes); en el tope, 400; el revisor sigue vivo: 20000 bytes por partes: error TypeError: fetch failed
```

Une autre panne était d'une autre famille : une requête vers une passerelle qui n'écoutait pas encore (`pasarela sin revisor: 0 null`). Celle-là est reprise à la fin de cette section.

**Comment nous l'avons mesurée.** Une vérification qui échoue de temps en temps se mesure mieux en l'isolant. `fig08_05.ts` répète 400 fois exactement le corps par morceaux qu'envoie la matrice (20 morceaux de 1000 octets, sans `Content-Length`) et compte ce qui s'est passé à chaque fois. Il faut le `revisor` à l'écoute : `node servidor.ts` depuis `fig08_01/`, dans un terminal, et dans un autre. Voici l'exécution contre le `revisor` **tel qu'il était avant de refermer la situation de compétition (race condition)**, qui est le contenu de `defectos/cierre-brusco/respuestas.ts` (on l'essaie en copiant `fig08_01/` dans un autre dossier et en remplaçant ce fichier ; la sortie complète est dans `defectos/cierre-brusco.salida.txt`) :

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

Sur 400 essais, le `revisor` a répondu `413` dans la majorité des cas ; dans les autres, le client n'a reçu aucune réponse : `EPIPE` (la connexion s'est rompue pendant que le client écrivait encore) et parfois `ECONNRESET`. Avec la première exécution et ses cinq répétitions, le `revisor` a répondu `413` entre 346 et 382 fois sur 400 : entre 18 et 54 essais sans réponse, soit entre 4,5 et 13,5 sur 100. Le chiffre change d'une exécution à l'autre, et cela faisait partie de ce qui la rendait difficile à voir : dans la matrice, qui fait *un* essai par exécution, elle se manifestait comme un échec occasionnel.

**La cause.** C'est une situation de compétition (race condition), et le RFC 9112, section 9.6, la décrit. Le `revisor` décide que le corps est trop grand dès qu'il compte plus de 16 KiB, répond `413` avec `Connection: close` et ferme. Mais le client continuait d'envoyer des morceaux. Quand une connexion est entièrement fermée et que des données arrivent encore, le système d'exploitation répond par un *reset* (RST), et la réinitialisation peut effacer la réponse que le client n'avait pas encore lue. Le RFC le dit ainsi : si un serveur ferme immédiatement une connexion TCP, « il y a un risque significatif que le client ne puisse pas lire la dernière réponse HTTP » (notre traduction). Et il décrit ce que les serveurs font habituellement pour l'éviter, qui est de **fermer par étapes** : on ferme d'abord seulement le côté écriture (*half-close*), puis on **continue de lire** jusqu'à ce que le client ferme (ou jusqu'à avoir une certitude raisonnable que le client a reçu la dernière réponse), et à la fin on ferme complètement. Remarque l'ordre : le RFC répond **d'abord** et continue de lire **ensuite**.

**Comment nous l'avons refermée, la première fois.** Il y a trois issues possibles, et une seule est honnête envers le serveur. **Réessayer le test** jusqu'à ce qu'il passe masque un défaut qui existe. **Accepter les deux issues** dans le test (un `413` ou une fermeture) cesse de dépendre de la situation de compétition, mais donne pour bon un serveur qui perd des réponses. **Corriger la fermeture dans le serveur** règle le problème là où il est. La première tentative a été la version la plus simple à écrire dans Node : **lire et jeter ce que le client continue d'envoyer, avec un plafond, et ensuite seulement répondre**. C'est le contenu de `defectos/drenar-antes/respuestas.ts` (la leçon ne l'utilise plus, mais on le conserve parce que sa limite a été mesurée) :

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

Lis-la calmement, car chaque ligne a sa raison :

- **Le motif est dans le commentaire** : continuer de lire et de jeter ce qui arrive évite le RST. Mais attention à l'ordre : cette version lit **avant** de répondre, et le RFC demande de répondre **d'abord**. C'est pourquoi le `413` tarde : il part quand le client a fini d'envoyer ou quand les plafonds sont dépassés.
- **`DRENAR_MAX_BYTES` (1 MiB) et `DRENAR_MAX_MS` (2 secondes)** sont les plafonds. Sans eux, le serveur lirait indéfiniment un corps qu'il a déjà décidé de rejeter, et offrirait la connexion à qui veut la retenir en envoyant sans arrêt. Avec les plafonds, le pire qu'on paie est 1 MiB et 2 secondes par connexion.
- **`fin` est l'unique chemin de sortie**, et il est appelé depuis quatre endroits : la fin du corps (`end`), la fermeture de la connexion (`close`), une erreur, ou le dépassement des plafonds. En sortant, il retire tous les écouteurs et arrête l'horloge.
- **`peticion.resume()`** met la requête en lecture. Les données arrivent à l'écouteur `data`, qui ne fait que compter les octets et les jeter.

Avec des corps comme celui de la matrice (20 Ko), cela a fonctionné : 400 sur 400. Mais il y a une limite qui a été mesurée, pas supposée. `fig08_05.ts` accepte un second argument, le nombre de morceaux de 1000 octets (20 par défaut), et on l'a exécuté contre cette copie avec des corps de 1 Mo, de 1,1 Mo et de 3 Mo, 100 essais chacun (`defectos/drenar-antes.salida.txt`) :

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

Jusqu'à 1 Mo, les 100 essais reçoivent leur `413`. Dès que le corps dépasse 1 MiB (1 048 576 octets) après le plafond, le serveur cesse de lire, répond et ferme, et le client, qui continue d'écrire, reçoit de nouveau le RST : **la situation de compétition réapparaît** et, avec 3 Mo, aucun essai ne reçoit de réponse. La première correction n'a pas refermé la situation de compétition : elle l'a déplacée au-delà du plafond. Un client qui envoie plus de 1 MiB est, de plus, celui qui s'est le plus probablement trompé de beaucoup.

**Comment nous l'avons refermée, la seconde fois : la fermeture par étapes que demande le RFC.** Ce qu'il faut, c'est ce que décrit le RFC : répondre **immédiatement**, fermer seulement l'écriture et continuer de lire. Node ne le fait pas tout seul : avec `Connection: close`, en finissant de répondre, il appelle `socket.destroySoon()`, qui ferme et détruit le socket (on peut le voir dans `lib/_http_server.js` ; la méthode est documentée dans [`net`](https://nodejs.org/docs/latest-v24.x/api/net.html#socketdestroysoon)). Voici la version que propose la leçon :

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

- **`socket.destroySoon = …`** change cette méthode **uniquement sur cette connexion**, pour qu'en finissant de répondre elle ne fasse que `socket.end()` : elle ferme l'écriture (*half-close*) et laisse la lecture ouverte.
- **`peticion.resume()`** continue de lire et de jeter ce que le client envoie. Il n'y a plus de plafond en octets : ce qu'on paie pour une telle connexion est, au maximum, **2 secondes** de lecture.
- **L'horloge de 2 secondes** détruit la connexion même si le client ne ferme pas, pour que personne ne la retienne ; `socket.once("close", …)` l'arrête si la connexion s'est terminée avant.
- **Le `413` part immédiatement**, parce que `leerCuerpo` appelle `cerrarConCalma` et rejette aussitôt, sans rien attendre.

Une limite qu'il vaut mieux dire : que `http` utilise `destroySoon` à la fermeture est un détail de la façon dont Node est fait, pas une promesse de sa documentation. Si une version ultérieure le changeait, `fig08_05.ts` le verrait (la mesure ci-dessous descendrait sous 400), et c'est pourquoi la mesure fait partie de la leçon et pas seulement du texte.

**Comment nous avons vérifié qu'elle est refermée.** Le même `fig08_05.ts`, cette fois contre le `revisor` de `fig08_01/` tel qu'il est dans la leçon (`fig08_05.salida.txt`), puis avec les gros corps qui avaient mis en échec la première correction (`fig08_05.limite.salida.txt`) :

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

Quatre cents sur quatre cents dans les six exécutions, contre entre 346 et 382 avant ; et cent sur cent avec des corps de 1 Mo, 3 Mo et 20 Mo, là où la première correction donnait zéro sur cent. C'est le contrôle : avec l'ancien code, la mesure voit le défaut ; avec le nouveau, non. Ce qui n'a **pas** été mesuré : ce qui se passe avec un client lent qui enverrait au compte-gouttes pendant plus de 2 secondes (le serveur détruit la connexion ; la réponse est déjà partie au début, et que le client l'ait lue avant le reset dépend de son propre rythme), ni la charge qu'accumulent beaucoup de connexions de ce genre en même temps.

**L'autre famille : le démarrage.** L'autre panne, celle de la passerelle, n'avait pas de rapport avec la fermeture mais avec le démarrage. La matrice attendait un temps fixe après avoir démarré chaque processus (une seconde pour le `revisor`, une demi-seconde pour la passerelle). Une attente fixe est un pari sur la durée du démarrage, et cette durée n'est pas constante. `fig08_06.ts` mesure la marge : il démarre la passerelle 100 fois et note combien de temps elle met à répondre ; dans les exécutions conservées (`ejercicios/ej6.salida.txt`), le maximum a été de 225 ms avec la machine libre et de 166 ms avec 20 processus qui tournaient, bien en dessous des 500 ms de l'attente. Autrement dit, il y a presque toujours de la marge, mais l'attente fixe n'est bonne que tant que le démarrage est plus court qu'elle, et c'est justement ce que tu ne contrôles pas. Pour voir la panne à dessein, `ejercicios/ej6/arranque-lento.sh` fait une copie d'un dossier et retarde de 700 ms le démarrage de `servidor.ts` et de `pasarela.ts` : avec la matrice à attentes fixes (`defectos/espera-fija/matriz23.ts`), on obtient `40 de 41`, et la vérification qui échoue est exactement celle qu'on a vue, `pasarela sin revisor: 0 null` ; avec la matrice de la leçon, on obtient `41 de 41`.

Le remède est celui qui avait été annoncé : attendre que le port accepte des connexions au lieu d'attendre un nombre de millisecondes. C'est ce que font les deux fonctions du début de `matriz23.ts` (et c'est l'objet de l'exercice 6) :

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

`esperarPuerto` interroge toutes les 100 ms, jusqu'à 10 secondes, et **lève une erreur** si le délai passe ou si le processus démarré est déjà sorti (par exemple à cause d'un port occupé) ; se terminer en silence laisserait la matrice mesurer personne. `arrancar` vérifie **avant** que le port soit libre : sans cela, un vieux `revisor` qui écoute déjà ferait que `esperarPuerto` tienne pour bon un nouveau processus mort avec `EADDRINUSE`. Avec les deux, la matrice de la leçon, exécutée 30 fois de suite avec `fig08_08.sh` (`fig08_08.salida.txt`), est sortie avec le code `0` les 30 fois, sur une machine d'usage normal. Cela ne prouve pas qu'elle ne puisse plus échouer ; cela prouve que le cas dont on savait qu'il échouait n'échoue plus, et que, désormais, si un processus ne démarre pas, la matrice le dit au lieu de mesurer autre chose.

### 8.15 Le `revisor` complet

Voici tous les fichiers de `fig08_01/`. Ceux qui changent ou naissent dans cette leçon viennent en premier ; les autres sont ceux des leçons précédentes dans leur version en vigueur, et ils sont là pour que tu puisses monter le dossier complet même si tu n'as pas fait les leçons précédentes. Le nom du dossier, `fig08_01`, apparaît sur la première ligne de chaque fichier, comme dans les leçons précédentes. Le document est le seul qui ne la porte pas, parce que JSON n'admet pas les commentaires.

#### 8.15.1 Les fichiers qui changent ou naissent

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

**`fig08_01/openapi.json`** (JSON n'admet pas les commentaires, donc ce fichier ne commence pas par la ligne habituelle) :

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
            "description": "http o https, sin usuario, clave, consulta (?) ni fragmento (#): el revisor la repite en cada representación del servicio (422 datos-invalidos si los trae); no puede apuntar a direcciones privadas ni reservadas (SSRF)."
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

#### 8.15.2 Les fichiers qui ne changent pas

Ce sont ceux des leçons précédentes dans leur version en vigueur ; seule la première ligne change, qui dit maintenant `fig08_01/`. `package.json` est le même que d'habitude :

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

// La url sale tal cual en cada representación del servicio: el 201, la consulta, la lista. Lo que una URL
// lleva de secreto —usuario y clave (http://usuario:clave@…) o un token en la consulta (?token=…)— saldría
// con ella, así que no se acepta. El fragmento (#…) tampoco: nunca viaja al servidor y solo estorba.
// Si el texto no se puede leer como URL, aquí no se decide: lo rechaza otra regla.
function urlConSecretos(texto: string): boolean {
  try {
    const url = new URL(texto);
    return url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "";
  } catch {
    return false;
  }
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
  else if (typeof url === "string" && urlConSecretos(url)) fallas.push({ campo: "url", detalle: "no puede llevar usuario, clave, consulta (?) ni fragmento (#)" });
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


### 8.16 Vérifier les types avec `tsc` (facultatif)

Depuis le dossier du `revisor`, avec la commande de la section 0.9 de la Leçon 0 plus `--allowImportingTsExtensions` :

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

Les programmes isolés de cette leçon (`fig08_02.ts`, `fig08_04.ts`, `fig08_05.ts`, `fig08_06.ts` et `fig08_07.ts`, et les variantes de `ejercicios/`) se vérifient de la même façon depuis le dossier qui les contient, en pointant vers le `tsc` que tu as installé dans `fig08_01/`.

## L'erreur que tu vas voir

### La matrice qui s'est ajustée au défaut

L'erreur la plus tentante face à une vérification qui passe au rouge est de la corriger au mauvais endroit. On est mardi, la matrice est rouge sur 17 lignes, il y a urgence, et quelqu'un ouvre `matriz23.ts` au lieu de `problemas.ts` : « on n'exige plus `Retry-After` », « on accepte `application/json` là où l'on attendait `application/problem+json` ». Deux lignes, et la matrice repasse au vert. C'est une copie de `matriz23.ts` avec exactement ces deux changements (à trois endroits, parce que la vérification du `429` par identifiant interroge aussi `Retry-After`) qui se trouve dans `defectos/matriz-bendice/`. Copie-la sur le dossier `rota/` de la section 8.10.1 (celui du serveur « nettoyé ») et exécute-la :

```text
$ node matriz23.ts   # la matriz «arreglada», contra el servidor con el defecto
ok    ETag tras reiniciar el revisor: la vieja no coincide (200, no un 304 falso)

41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
(código de salida: 0)
```

Vert. **41 sur 41** et code de sortie `0`, contre le même serveur qui, il y a un instant, a mis la matrice à 17 lignes rouges. Le serveur n'a pas changé ; c'est l'étalon qui a changé. C'est ce que le cours appelle un test qui **bénit le défaut** : il passe, et ce qui passe, c'est l'erreur.

C'est pire qu'un test qui échoue, pour une raison concrète : un test rouge attire l'attention de quelqu'un, et un test vert la retire. À partir de ce moment, le tableau de bord dit « tout va bien », et les intégrateurs de la scène du début recommencent à recevoir `application/json`. Le défaut n'a plus personne pour le surveiller.

Trois habitudes l'évitent, et toutes les trois coûtent peu :

- **Un changement dans ce que le test attend est un changement de promesse.** On le révise comme on révise un changement dans l'API : qui a été prévenu ? Le document dit-il la même chose ? Ici, `openapi.json` dit toujours `application/problem+json` ; la matrice ajustée ne coïncide plus avec le document, et cette divergence devrait être la première chose que quelqu'un remarque.
- **Avant d'assouplir un test, demande-toi lequel des trois ment.** Le serveur, le document ou le test. Avec 17 lignes rouges portant presque la même phrase, il est bien plus probable qu'une chose ait changé dans le serveur que 17 dans le test.
- **Annule et vérifie qu'il passe au rouge.** C'est la règle de toute la leçon : un test qu'on n'a pas vu échouer contre le défaut ne démontre rien. Ici, exécuter la matrice **originale** contre le serveur avec le défaut donne du rouge ; exécuter celle qui a été ajustée, du vert. La différence entre les deux est toute l'information.

### Le serveur resté ouvert

La seconde erreur n'est pas de conception, c'est un oubli, et elle a des conséquences subtiles. La matrice démarre son propre `revisor` sur le port 18080. Mais s'il y en a déjà un à l'écoute là (un `revisor` d'une leçon précédente, ou la copie `rota/` de la section 8.10 que tu n'as pas arrêtée), le nouveau programme ne peut pas occuper le port, et personne ne le dit : les enfants sont démarrés avec `stdio: "ignore"`. La version de la matrice qui ne se défendait pas contre cela continuait en mesurant l'ancien serveur. Celle de la leçon se défend : avant de démarrer quoi que ce soit, elle vérifie les trois ports. Pour le voir, laisse tourner dans un terminal le serveur de la copie `rota/`, celui qui est « nettoyé », et depuis un autre, exécute la matrice **de `fig08_01/`**, la bonne ; ensuite, la version précédente de la matrice (`defectos/espera-fija/matriz23.ts`, qui n'a pas ce contrôle) :

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

Quand tu as fini, arrête le serveur de `rota/` par son PID (`kill %1` si tu l'as lancé dans ce même terminal avec `&`) et vérifie avec la commande ci-dessous que les ports sont libres. La première matrice refuse de mesurer : elle dit quel port est occupé et sort avec `2`, un code distinct du `1` de « quelque chose a échoué ». La seconde montre ce qui se passait avant. Le dossier `fig08_01` n'a pas le défaut, mais la matrice précédente affiche les mêmes seize lignes rouges des scénarios de la section 8.10.1. Celui qui la lirait sans savoir pour le serveur ouvert chercherait l'erreur dans le mauvais code : la matrice n'a pas mesuré son propre `revisor`, elle a mesuré celui qui était déjà là.

Et remarque comment elle se terminait, car c'était la seconde moitié du problème : **elle n'imprimait pas le résumé**. La dernière ligne de la sortie ci-dessus (« ESTADO: … ») n'a pas été écrite par la matrice mais par le script qui l'a exécutée pour cette leçon : la matrice est restée à attendre, sans rien dire, et au bout de 60 secondes on l'a arrêtée par son PID. Elle restait à attendre parce que l'une de ses vérifications supplémentaires arrête « son » `revisor` pour tester la passerelle, et attend l'avis qu'il s'est terminé ; ce `revisor` n'a jamais existé, donc l'avis n'arrivait pas. Un programme qui reste muet devant un port occupé, au lieu de dire « le port 18080 est occupé », est un défaut, et c'est pourquoi la matrice de la leçon apporte le contrôle que `fig08_03.sh` avait déjà (section 8.9). Ce qui ne change pas, c'est la règle de fond, celle que le cours répète depuis la Leçon 0 : `127.0.0.1:18080` ne dit pas ce qu'il y a derrière, seulement que quelque chose a répondu. Si tu écris ton propre programme qui démarre des processus, donne-lui le même contrôle, et si tu l'exécutes à la main, vérifie d'abord que les ports sont libres :

```bash
for p in 18080 18081 18082; do (exec 3<>/dev/tcp/127.0.0.1/$p) 2>/dev/null && echo "ocupado: $p"; done
```

Si la commande n'imprime rien, les trois ports sont libres.

## Les erreurs courantes

**Documenter de mémoire.** Un document écrit à partir de ce qu'on croit que fait l'API finit par décrire l'API qu'on a imaginée. On l'écrit en regardant les vraies réponses, puis on le vérifie avec la matrice.

**Ne documenter que le chemin heureux.** Un document avec les succès et sans les erreurs laisse au client la moitié du travail : il doit découvrir les `4xx` et les `5xx` par tâtonnement. Les erreurs se documentent avec la même précision que les succès, avec leur type de contenu et leurs en-têtes.

**Écrire la même réponse d'erreur dans chaque opération.** Elle se désynchronise dès que quelqu'un en corrige une et pas les autres. Les réponses d'erreur s'écrivent une fois dans `components` et se réutilisent avec `$ref`.

**Mettre le type de contenu comme en-tête.** Un `Content-Type` dans `headers` est ignoré ; le type va comme clé de `content`.

**Confondre `info.version` avec la version de l'API.** C'est la version du document. S'il faut dire quelle est l'API en vigueur et lesquelles sont retirées, on l'écrit dans la description et on marque `deprecated` sur les routes.

**Tenir un document pour bon parce que le validateur dit « valide ».** Le validateur répond s'il est bien écrit, pas s'il est vrai (section 8.11).

**Ne tester que les codes.** C'est la scène du début. Le code est ce qu'il y a de plus facile à tester et la seule chose que vérifiaient les tests de ce matin-là.

**Assouplir un test pour le passer au vert.** Un test qui s'ajuste au défaut passe, et ce qui passe, c'est le défaut (section « La matrice qui s'est ajustée au défaut »).

**Mesurer le mauvais serveur.** Un port occupé par un vieux programme laisse un programme mesurer ce qui n'est pas à lui ; c'est pourquoi la matrice vérifie les ports avant de démarrer et sort avec `2` si l'un répond (section « Le serveur resté ouvert »).

**Réessayer un test jusqu'à ce qu'il passe.** Une vérification qui échoue parfois a une cause. La comprendre (section 8.14.1) coûte moins cher que de se méfier de toutes les autres.

**Valider la destination et laisser quelqu'un d'autre résoudre le nom.** Ce sont deux résolutions et, entre l'une et l'autre, le nom peut changer de propriétaire. L'adresse qu'on valide est l'adresse à laquelle on se connecte.

**Compter sur le document pour éloigner ceux qui ne devraient pas le lire.** Un document OpenAPI est presque toujours publié. Ce qui ne peut pas y figurer (noms de machines internes, adresses privées, exemples avec de vraies données) ne s'y écrit pas, pas même comme exemple.

## Exercices

Les six se corrigent tout seuls : chacun se termine par une exécution qui te dit si tu as juste (dans le 5 et le 6, avec un contrôle qui échoue à dessein). Écris ta prédiction dans le [journal de bord](bitacora.md) **avant** d'exécuter quoi que ce soit. Pour les exercices 1 à 3, il te faut le dossier `fig08_01/` et les ports 18080, 18081 et 18082 libres (le troisième est utilisé par la passerelle d'une des vérifications supplémentaires) ; pour le 4, le 18081 et le `::1`.

### Exercice 1 — Comble la lacune du catalogue

La section 8.5 a trouvé que `fig08_02.ts` signale une lacune : le document ne mentionne pas le `type` `revision-inexistente`, et la route `GET /revisiones/{id}` le renvoie. Corrige une **copie** de `openapi.json` : ajoute une réponse réutilisable pour le `404` de cette route, nomme-la comme tu veux, et fais pointer l'opération vers elle. Pour savoir si tu as juste, exécute les trois vérificateurs avec ta copie : `fig08_02.ts` doit dire « 0 con un hueco en el documento » ; `matriz23.ts` doit rester à 41 sur 41 ; et `redocly lint` doit continuer à dire « valid ». Prédis d'abord : combien d'avertissements le validateur va-t-il donner, plus, moins ou autant ?

### Exercice 2 — Fais voir `detail` et `instance` à la matrice

La section 8.14 a dit que la matrice ne vérifie que trois des cinq membres d'un Problem Details. Ajoute deux lignes à `comprobar` pour qu'elle exige aussi `detail` et `instance` comme texte, dans toutes les erreurs. Prédis : avec ta matrice étendue, combien de lignes rouges donne le bon `revisor` ? Ensuite, copie `ejercicios/ej2/defecto-sin-instance/problemas.ts` sur une copie de `fig08_01/` (c'est un serveur qui a oublié `instance`) et prédis deux choses : combien de lignes rouges donne la matrice **originale** contre ce serveur, et combien donne la tienne.

### Exercice 3 — Retire le `405` du document

C'était l'idée de la section 8.4.4. Dans une copie de `openapi.json`, supprime la réponse `405` de `GET /servicios/{id}` et exécute la matrice. Prédis : combien de lignes rouges ? Quel est le message exact ? Ensuite, exécute `redocly lint` sur le même document : le validateur le détecte-t-il ?

### Exercice 4 — Quel `Host` le serveur reçoit-il ?

La section 8.12.3 a dit que le client se connecte à l'adresse déjà validée, mais que l'en-tête `Host` conserve le nom. Modifie `fig08_04.ts` pour que le « laboratoire » imprime le `Host` qu'il a reçu à chaque requête. Prédis : quand tu exécuteras la version avec `fetch`, le serveur qui répond imprime-t-il quelque chose ? Et quand tu exécuteras celle de la leçon ? Quelle valeur a `Host` dans ce cas ?

### Exercice 5 — Reproduis la situation de compétition et les deux fermetures

La section 8.14.1 a raconté une situation de compétition (race condition), une première correction avec sa limite et la fermeture par étapes. Reproduis-les toi-même. Copie `fig08_01/` dans un dossier `viejo/`, remplace `respuestas.ts` par `defectos/cierre-brusco/respuestas.ts`, démarre le `revisor` de `viejo/` et exécute `fig08_05.ts` trois fois. Prédis d'abord : le nombre de réponses `413` sera-t-il le même dans les trois ? Quelle sera la cause de celles qui ne reçoivent pas de réponse ? Ensuite, arrête ce `revisor`, répète avec `defectos/drenar-antes/respuestas.ts` et exécute `node fig08_05.ts 100 3000` (3 Mo par essai) : prédis combien des 100 reçoivent leur `413`. Enfin, répète ces 3 Mo contre le `revisor` de `fig08_01/` tel qu'il est. Arrête chaque `revisor` par son PID avant de démarrer le suivant. Réponds avec des arguments : pourquoi la première correction échoue-t-elle au-dessus de 1 MiB et la seconde non ? Que continue-t-on à payer dans la seconde ? Que se passerait-il si une version de Node cessait d'appeler `socket.destroySoon()` à la fermeture ?
### Exercice 6 — Referme l'attente fixe

La section 8.14.1 s'est terminée sur une fragilité que la matrice de la leçon n'a plus : attendre un temps fixe après avoir démarré chaque processus. Ici, c'est toi qui la corriges, en partant de la version qui l'a : `defectos/espera-fija/matriz23.ts`. Commence par mesurer la marge avec `fig08_06.ts`, qui démarre la passerelle 100 fois et dit combien de temps elle met à répondre. Ensuite, copie `fig08_01/` dans un dossier `mia/`, mets-y `defectos/espera-fija/matriz23.ts` et modifie-la pour qu'au lieu d'attendre un temps, elle attende que le port accepte des connexions (et échoue avec un message s'il ne le fait pas). Pour savoir si tu as juste, exécute `ejercicios/ej6/arranque-lento.sh` sur un dossier contenant cette matrice : il retarde de 700 ms le démarrage du `revisor` et de la passerelle. Prédis d'abord : combien de vérifications passent avec l'attente fixe et combien avec la tienne ? Combien de temps crois-tu que la passerelle met à répondre, dans le pire des 100 démarrages ? Enfin, exécute ta matrice huit fois de suite avec la machine saturée (par exemple, avec deux fois plus de programmes `node -e 'while(true){}'` que ton CPU n'a de cœurs, que tu arrêtes par leur PID à la fin).

## Solutions

### Solution 1

La solution se trouve dans `ejercicios/ej1/openapi.json`. Elle ajoute une réponse `E404Revision` à côté de `E404`, avec la description « La revisión no existe (type revision-inexistente). » et le même contenu, et fait pointer `GET /revisiones/{id}` vers elle :

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

Les trois exécutions, avec ce document :

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

`fig08_02.ts` passe d'une lacune à **zéro lacune** ; la matrice reste à 41 sur 41, parce que le changement ne retire rien de ce que la matrice cherche ; et le validateur continue de dire « valid » avec **les mêmes 26 avertissements** : on a ajouté une réponse qui est bel et bien utilisée, donc il n'y a ni composants inutilisés ni nouvelles opérations. Si tu as prédit plus d'avertissements, tu as probablement pensé que tout ajout augmente le bruit ; ici, il n'en ajoute pas, parce que le validateur ne compte que ce qui n'est pas complet.

### Solution 2

Les deux lignes se trouvent dans `ejercicios/ej2/matriz23.ts`, juste sous celle qui exige `title` :

```ts
      if (typeof cuerpo.title !== "string") fallas.push("falta title");
      if (typeof cuerpo.detail !== "string") fallas.push("falta detail");
      if (typeof cuerpo.instance !== "string") fallas.push("falta instance");
```

Deux lignes qui exigent maintenant `detail` et `instance` comme texte. Les trois exécutions :

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

La première exécution est la plus importante : **la matrice originale, contre un serveur auquel il manque `instance` dans toutes ses erreurs, donne 40 sur 41**. La seule ligne rouge est celle du `500`, parce que ce scénario exigeait déjà que `instance` soit un `urn:uuid` ; les 15 autres erreurs avec le défaut sont passées. C'est ce que signifie « le test ne regarde pas ce qu'il ne regarde pas ». La deuxième exécution confirme que la matrice étendue reste à 41 sur 41 avec le bon serveur (rien de ce qu'on a ajouté ne casse ce qui fonctionnait déjà). La troisième est le contrôle positif : contre le serveur avec le défaut, la matrice étendue signale les **16 scénarios d'erreur**, un pour chaque erreur, jusqu'à tomber à 25 sur 41. C'est la leçon de la section 8.10 appliquée à un test à toi : tu as étendu un étalon et tu l'as vu mordre.

Si ta prédiction pour la troisième était différente, compte les scénarios qui sont des erreurs : seize des 23 codes en sont (du `400` au `504`), et les vérifications supplémentaires ne passent pas par `comprobar`, donc elles ne sont pas contaminées.

### Solution 3

Le document sans le `405` se construit avec une ligne de Node sur une copie :

```bash
node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync("openapi.json","utf8")); delete d.paths["/servicios/{id}"].get.responses["405"]; fs.writeFileSync("openapi.json", JSON.stringify(d,null,2)+"\n");'
```

On l'exécute dans le dossier de la copie, puis la matrice et le validateur :

```text
$ node matriz23.ts   # sin el 405 de GET /servicios/{id} en el documento
FALLA 405 método no admitido: openapi.json no documenta 405 en GET /servicios/{id}

40 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).

$ npx redocly lint openapi.json --format=stylish   # el mismo documento
Woohoo! Your API description is valid. 🎉
You have 26 warnings.
```

Une ligne rouge dans la matrice, avec le message exact de la section 8.6.3 : `openapi.json no documenta 405 en GET /servicios/{id}`. Et le validateur, qui regarde le document sans rien savoir du serveur, le tient pour valide : aucune règle ne dit « une opération doit déclarer un `405` ». C'est le tableau de 8.11.3 en une ligne. Si, dans l'exécution de la matrice, une seconde ligne rouge apparaît (la vérification du corps par morceaux), c'est la situation de compétition (race condition) de la section 8.14.1 et elle n'a rien à voir avec ton changement.

### Solution 4

La variante se trouve dans `ejercicios/ej4/fig08_04.ts`. Elle ne change qu'une seule chose, le « laboratoire » :

```ts
const laboratorio = createServer((p, r) => {
  console.log(`  el laboratorio recibió Host: ${p.headers.host ?? "(ninguno)"}`);
  r.writeHead(200);
  r.end();
});
```

Et l'exécution, avec la version de la leçon :

```text
$ node fig08_04.ts fig08_01   # la variante del ejercicio 4
$ consultar("http://rebote.ejemplo:18081/")   con el cliente de fig08_01
  pregunta 1 al DNS: rebote.ejemplo -> 127.0.0.1
  el laboratorio recibió Host: rebote.ejemplo:18081
{"tipo":"respuesta","codigo":200,"ms":4,"reintentarEn":null}
el DNS fue preguntado 1 vez
```

Le laboratoire a reçu `Host: rebote.ejemplo:18081` : le nom de l'URL, avec son port, même si la connexion est allée à `127.0.0.1`. C'est ce que fait l'option `lookup` : elle décide **où** se connecter et ne touche pas à **ce qui se dit** une fois connecté. Avec le client de `fetch` (`con-fetch`), le laboratoire n'imprime rien, parce que la connexion ne l'a pas atteint : elle est arrivée au serveur du `299`, qui n'imprime rien. Si tu as prédit que le `Host` serait `127.0.0.1:18081`, tu as pensé que celui qui se connecte à une IP l'utilise aussi comme nom ; c'est ainsi que fonctionne une requête écrite à la main avec l'IP dans l'URL, et c'est pourquoi le client de la leçon n'écrit pas l'IP dans l'URL.

### Solution 5

Les chiffres se trouvent dans quatre fichiers : `defectos/cierre-brusco.salida.txt` (la fermeture brutale), `defectos/drenar-antes.salida.txt` (jeter le corps avant de répondre), `fig08_05.salida.txt` et `fig08_05.limite.salida.txt` (la fermeture par étapes). La fermeture brutale :

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

Avec le code brutal, le nombre de `413` change d'une exécution à l'autre (la situation de compétition (race condition) dépend de la façon dont le temps se répartit entre la fermeture du serveur et l'écriture du client) et n'atteint 400 dans aucune ; celles qui manquent finissent en `EPIPE`, avec quelques `ECONNRESET`. La première correction, avec 400 essais de 20 Ko puis avec des corps plus grands :

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

Jusqu'à 1 Mo, 100 sur 100 ; avec 1,1 Mo, 8 sur 100 ; avec 3 Mo, 0 sur 100. Et la fermeture par étapes, avec les corps habituels et avec les gros :

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

**400 sur 400** dans les six exécutions, et **100 sur 100** avec 1 Mo, 3 Mo et 20 Mo.

Sur les différences. La première correction **lit avant de répondre** et a un plafond de 1 MiB : au-dessus du plafond, elle répond et ferme d'un coup, de sorte que le client qui continue d'écrire reçoit de nouveau le RST et perd le `413` ; le plafond a déplacé la situation de compétition, il ne l'a pas refermée. La seconde fait ce que décrit le RFC 9112 : elle **répond immédiatement**, ferme seulement l'écriture (`socket.end()`) et continue de lire et de jeter ce qui arrive, de sorte que le client peut lire le `413` même s'il continue d'envoyer, jusqu'aux 2 secondes de l'horloge. Ce qu'on continue de payer : pendant ces 2 secondes, le serveur lit ce que le client veut bien envoyer (il n'y a plus de plafond en octets). Ce qui dépend de Node : que `http` appelle `socket.destroySoon()` en fermant une réponse avec `Connection: close` ; s'il cessait de le faire, le remplacement ne s'exécuterait pas et la mesure tomberait sous 400, ce qui est la raison de l'avoir.

### Solution 6

La solution se trouve dans `fig08_01/matriz23.ts` elle-même (`ejercicios/ej6/matriz23.ts` est la même) : deux fonctions au début du fichier qui remplacent les quatre attentes fixes qui suivaient le démarrage d'un processus.

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

`await esperar(500)` (la passerelle) et les trois `await esperar(1000)` (le `revisor`, deux fois, et la matrice au démarrage) deviennent `arrancar("pasarela.ts", 18082)`, `arrancar("servidor.ts", 18080)` et `esperarPuerto(18081, …)` et `esperarPuerto(18080, …)` avec le port qui convient ; et au début de l'exécution, un contrôle qui sort avec `2` si l'un des trois ports répond déjà. Les mesures, toutes conservées dans `ejercicios/ej6.salida.txt` (là, `espera-fija/` est une copie de `fig08_01/` avec `defectos/espera-fija/matriz23.ts` par-dessus, et les ports ont été réécrits comme dans le reste de la leçon) :

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

Lis-la avec soin, parce que ce qu'elle dit et ce qu'elle ne dit pas comptent autant l'un que l'autre. La première partie donne la marge : combien de temps la passerelle a mis à répondre sur 100 démarrages, et combien ont dépassé les 500 ms qu'attendait la matrice à attentes fixes (et les 1000 qu'elle attendait pour le `revisor`). La deuxième répète la mesure avec le CPU saturé. La troisième exécute les deux matrices huit fois avec ces processus qui tournent.

Ce qui **a** été mesuré : avec la machine saturée, aucune des deux matrices n'a échoué, et les démarrages ont tenu dans l'attente ; saturer le CPU n'a pas suffi à provoquer la panne (le système d'exploitation donne souvent la priorité à un processus récemment créé), de sorte que cette expérience ne distingue pas les deux matrices. Ce qui les distingue, c'est le **contrôle négatif**, et celui-là est reproductible : avec le démarrage retardé de 700 ms à dessein, la matrice à attentes fixes donne `40 de 41`, avec la panne `pasarela sin revisor: 0 null` qu'on avait vue pendant la leçon, et la matrice avec `esperarPuerto` donne `41 de 41`. Et si quelque chose occupe déjà un port, la matrice le dit et sort avec `2` sans rien mesurer. Une réserve : le retard de 700 ms, c'est nous qui l'avons choisi pour qu'il tombe entre les deux attentes fixes (500 et 1000 ms). Que l'attente par port tienne relève du raisonnement plus de la mesure ; cela ne prouve pas qu'aucun démarrage, sur aucune machine, ne dépasse les 10 secondes qu'elle accorde.

## Clôture du cours : comment savoir que tu as terminé

Le README du cours a promis cinq choses que ton API doit remplir à la fin. Avec cette leçon, les cinq sont vérifiables, et voici ce que vérifie chacune :

| Promesse du cours | Ce qui la vérifie |
|---|---|
| La matrice de 23 scénarios s'exécute avec une seule commande, et chaque ligne vérifie code, en-têtes, type de contenu et corps | `node matriz23.ts` (section 8.7) |
| Aucune réponse d'erreur n'est `200` ni HTML ; toutes sont `application/problem+json` avec un `type` stable | le type de contenu et le `type` de chaque scénario (8.6.3) et le croisement du catalogue (8.5) |
| Aucun corps de `5xx` ne contient de piles, de requêtes, de chemins ni de clés | la liste des fuites des `5xx` (8.6.4), avec les réserves de 8.14 |
| Un `POST` répété avec la même clé ne duplique rien ; avec un autre corps, `422` ; en cours, `409` | la vérification supplémentaire 1 (8.8) et `fig06_03.ts` de la Leçon 6 |
| Le `revisor` classe les 23 cas avec un tableau et ne réessaie pas ce qu'il ne doit pas | `tabla23.ts` de la Leçon 7, qui donne toujours la même chose après le changement de `cliente.ts` |

Deux avertissements d'honnêteté, parce que ce cours les a répétés : `Idempotency-Key` et les en-têtes `RateLimit-*` ne sont toujours pas un standard (le brouillon de la première a expiré le 18 avril 2026 sans être publié comme RFC ; celui de `RateLimit-*` reste un brouillon actif de l'IETF), et une matrice verte dit que **ce que la matrice regarde** est correct. Ce qu'elle ne regarde pas (section 8.14) reste entre tes mains.

## Comment savoir que tu y es arrivé

- [ ] Tu ouvres `openapi.json` et tu désignes ses cinq pièces : `info`, `servers`, `security`, `paths` et `components` ; et tu expliques pourquoi `info.version` n'est pas la version de l'API.
- [ ] Tu expliques pourquoi les réponses d'erreur s'écrivent une fois dans `components` et se réutilisent avec `$ref`, et tu dis combien de références il y a vers combien de réponses (79 vers 18).
- [ ] `node fig08_02.ts` signale une lacune (`revision-inexistente`) avec le document de la leçon, et zéro lacune avec celui de l'exercice 1.
- [ ] `node matriz23.ts` donne `41 de 41` et sort avec `0` ; avec `defectos/sin-problem-json/problemas.ts`, il donne `24 de 41` et sort avec `1` ; avec `defectos/sin-429-documentado/openapi.json`, il donne `40 de 41`.
- [ ] `bash fig08_03.sh` donne `23 de 23`, et tu expliques ce que la version `curl` vérifie en moins que celle de TypeScript.
- [ ] Avec Redocly CLI, le document donne « valid » avec 26 avertissements, le document cassé donne deux erreurs, et le document sans le `429` donne aussi « valid » ; et tu expliques pourquoi.
- [ ] `node fig08_04.ts con-fetch` arrive au serveur du `299` avec deux questions au DNS, et `node fig08_04.ts fig08_01` arrive au laboratoire avec une ; et tu dis pourquoi le certificat est toujours vérifié contre le nom.
- [ ] Tu expliques `Deprecation`, `Sunset` et `Link` avec `rel="deprecation"`, et ce que marque `deprecated: true` dans le document.
- [ ] Tu dis, avec deux exemples mesurés, ce que la matrice ne peut pas voir.
- [ ] `fig08_05.ts` donne 400 sur 400 contre `fig08_01/` et moins de 400 contre le `respuestas.ts` de `defectos/cierre-brusco/` ; avec 3 Mo (`node fig08_05.ts 100 3000`), il donne 100 sur 100 contre `fig08_01/` et 0 sur 100 contre `defectos/drenar-antes/` ; et tu expliques pourquoi répondre d'abord et fermer seulement l'écriture la referme.
- [ ] La matrice « ajustée » donne du vert contre le serveur avec le défaut, et tu expliques pourquoi c'est pire qu'une matrice rouge.
- [ ] À la fin, aucun programme n'écoute plus : `curl -i http://127.0.0.1:18080/` et `curl -i http://127.0.0.1:18081/` donnent l'erreur 7.

## Résumé

Réponds sans regarder la leçon :

1. Quelles sont les cinq pièces d'un document OpenAPI et que contient chacune ? Qu'est-ce que `info.version` ?
2. À quoi sert `$ref`, et pourquoi les réponses d'erreur vont-elles dans `components` ?
3. Quelles quatre choses promet une réponse, et lesquelles le « nettoyage » du début a-t-il rompues ?
4. Que vérifie `comprobar` dans chaque scénario, dans l'ordre ? Pourquoi rassemble-t-elle toutes les pannes au lieu de s'arrêter à la première ?
5. Qu'est-ce qu'une régression, et combien de vérifications supplémentaires la matrice comporte-t-elle ?
6. Que dit un validateur OpenAPI et que ne dit-il pas ? À quelle question la matrice répond-elle ?
7. Qu'est-ce qu'un test qui « bénit le défaut » ? Comment l'évite-t-on ?
8. Qu'est-ce que le *DNS rebinding* ? Pourquoi valider avant chaque connexion ne le ferme-t-il pas, et qu'est-ce qui le ferme ?
9. Que fait l'option `lookup` et que ne fait-elle pas ? Pourquoi `soloA` répond-elle de deux manières ?
10. Que disent `Deprecation`, `Sunset` et `Link` avec `rel="deprecation"`, et que marque `deprecated: true` ?
11. Nomme trois choses que la matrice ne voit pas.
12. Pourquoi la vérification du corps par morceaux échouait-elle parfois ? Comment l'a-t-on mesurée et comment l'a-t-on refermée ? Pourquoi la première correction (jeter le corps avant de répondre) avait-elle une limite alors que la fermeture par étapes n'en a pas ?

## Sources

Toutes consultées le 21 octobre 2026.

1. [OpenAPI Specification v3.1.1](https://spec.openapis.org/oas/v3.1.1.html) (24 octobre 2024) : `info.version` comme version du document (4.8.2.1), `servers` (4.8.1.1), l'objet d'opération, `deprecated`, `security` et `operationId` (4.8.10.1), les objets de chemin (4.8.9.1), de paramètre (4.8.12.2.1), de réponses et de réponse (4.8.16 et 4.8.17), de référence (4.8.23.1), de schéma (4.8.24) et les extensions en `x-` (4.9).
2. [Migrating from OpenAPI 3.0 to 3.1.0](https://www.openapis.org/blog/2021/02/16/migrating-from-openapi-3-0-to-3-1-0) (P. Sturgeon, 16 février 2021) : l'alignement sur JSON Schema 2020-12 et le remplacement de `nullable` par une liste de types.
3. [RFC 9457, *Problem Details for HTTP APIs*](https://www.rfc-editor.org/rfc/rfc9457.html) (juillet 2023, voie des standards ; remplace le RFC 7807) : les membres `type`, `title`, `status`, `detail` et `instance` (3.1), et les membres d'extension, que celui qui consomme doit ignorer s'il ne les reconnaît pas (3.2).
4. [IANA, registre de `application/problem+json`](https://www.iana.org/assignments/media-types/application/problem+json) : le type de contenu et sa référence, le RFC 9457.
5. [RFC 9110, *HTTP Semantics*](https://www.rfc-editor.org/rfc/rfc9110.html) : `Allow` dans le `405` (15.5.6), `Retry-After` dans le `503` (15.6.4).
6. [RFC 9112, *HTTP/1.1*, section 9.6 (*Tear-down*)](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.6) : le risque de fermer une connexion immédiatement et la fermeture par étapes.
7. [RFC 9745, *The Deprecation HTTP Response Header Field*](https://www.rfc-editor.org/rfc/rfc9745.html) (mars 2025, voie des standards) : `Deprecation` comme date de champ structuré, la relation avec `Sunset` et la relation `deprecation` de `Link`.
8. [RFC 8594, *The Sunset HTTP Header Field*](https://www.rfc-editor.org/rfc/rfc8594.html) (mai 2019, informatif) : le format et le fait que les dates sont des indices.
9. [Node.js, `net.connect`](https://nodejs.org/docs/latest-v24.x/api/net.html) : l'option `lookup` et `autoSelectFamily` (activée par défaut depuis la version 20).
10. [Node.js, `dns.lookup`](https://nodejs.org/docs/latest-v24.x/api/dns.html) : l'option `all` et la forme du *callback* dans chaque cas.
11. [Node.js, `http.request`](https://nodejs.org/docs/latest-v24.x/api/http.html) : les options `agent: false`, `lookup` et `signal`, et le mélange de `url` et `options`.
12. [Node.js 24.14.1 « Krypton » (LTS)](https://nodejs.org/en/blog/release/v24.14.1) (24 mars 2026) : la version avec laquelle les sorties ont été obtenues.
13. [OWASP, *Server-Side Request Forgery Prevention Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) : *DNS rebinding* et fixation de la connexion, redirections, listes d'autorisation face aux listes de blocage.
14. [GHSA-489g-7rxv-6c8q](https://github.com/advisories/GHSA-489g-7rxv-6c8q) (10 juillet 2026) : *MCP Atlassian*, une correction de SSRF incomplète faute de fixer l'IP validée ; corrigé dans la version 0.22.0.
15. [GHSA-9hgc-g3w5-67cm, CVE-2026-53708](https://github.com/advisories/GHSA-9hgc-g3w5-67cm) (15 juin 2026) : *ContextForge*, une situation de compétition (race condition) entre la validation et la connexion dans un point d'accès d'administration ; corrigé dans la version 1.0.3. C'est la source primaire qui a été consultée : la page du NVD (nvd.nist.gov) de ce CVE n'a renvoyé aucun contenu lisible lors de la consultation.
16. [Redocly CLI, commande `lint`](https://redocly.com/docs/cli/commands/lint) : ce qu'elle fait, l'ensemble de règles recommandé par défaut et les formats de sortie ; la version utilisée est la 2.57.0 (30 septembre 2026), sous licence MIT.

### Termes de cette leçon

| | |
|---|---|
| **OpenAPI** | la spécification pour décrire une API HTTP dans un document que les machines lisent ; le cours utilise la 3.1.1 |
| **opération** | une méthode sur une route (`GET /servicios/{id}`) et tout ce qu'on dit d'elle |
| **`$ref`** | la référence à une pièce écrite ailleurs dans le document, normalement dans `components` |
| **validateur (*linter*)** | le programme qui dit si un document est bien écrit selon la spécification |
| **matrice** | la table de scénarios qu'on parcourt avec une seule commande, en comparant chaque réponse à ce qui a été promis |
| **régression** | un test de quelque chose qui a déjà été corrigé une fois, pour que cela ne revienne pas sans que personne ne s'en aperçoive |
| **que le test morde** | démontrer qu'un test détecte un défaut en défaisant la correction et en le voyant au rouge |
| **bénir le défaut** | qu'un test passe parce qu'il s'est ajusté à ce qui est cassé au lieu d'exiger ce qui a été promis |
| **DNS rebinding** | qu'un nom change d'adresse entre la vérification et la connexion, à cause d'une réponse DNS qui ment la seconde fois |
| **TOCTOU** | *time of check, time of use* : une situation de compétition (race condition) entre le moment où l'on vérifie quelque chose et celui où on l'utilise |
| **`deprecated`** | le champ d'une opération qui avertit qu'il ne convient plus de l'utiliser |
| **`Deprecation`, `Sunset`** | les en-têtes qui disent depuis quand quelque chose est déprécié et quand on s'attend à ce qu'il cesse de répondre |

---

Avec cette leçon, le cours se termine ; la suite, c'est ton journal de bord.

**Précédente :** [Leçon 7 — Celui qui lit l'erreur : le client du `revisor` et les agents d'IA](07-quien-lee-el-error.md)

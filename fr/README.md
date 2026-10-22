# Des erreurs qui enseignent : codes HTTP et Problem Details — une API qui dit la vérité quand elle échoue

**Par Dorian Chávez, fondateur de Hábil et architecte d'intégration.**

**À qui il s'adresse :** à qui a déjà écrit une API dans n'importe quel langage et a déjà renvoyé un `200` avec un corps disant `{"error": …}`, a utilisé `500` pour tout ce qui s'est mal passé, ou n'a pas su expliquer la différence entre `401` et `403`, entre `409` et `412`, entre `400` et `422` ; et à qui consomme des API tierces et veut cesser de deviner quoi faire lorsqu'elles échouent. C'est un cours de niveau intermédiaire : on suppose que tu sais ce qu'est une requête HTTP, ce qu'est JSON et comment démarrer un serveur. On ne suppose pas que tu connaisses les spécifications : chaque code est expliqué au moment où il apparaît, et l'on explique pourquoi il existe, pas seulement quel numéro utiliser.

**Ce que tu sauras faire à la fin :** choisir le bon code avec une question à laquelle on peut répondre, produire des réponses d'erreur qu'une machine sait lire (le format des *Problem Details* de la RFC 9457), décider de ce qui se réessaie et de ce qui ne se réessaie pas, et démontrer avec `curl` que ton API fait ce qu'elle dit. Et garder le jugement nécessaire pour lire les spécifications par toi-même.

**Ce dont tu as besoin avant de commencer :** un ordinateur avec Linux Mint, savoir ouvrir un terminal et lire un programme court en TypeScript. Les programmes utilisent Node 24 sans une seule dépendance, et l'instrument de tout le cours est `curl`. La [Leçon 0](00-el-contrato-que-viaja.md) prépare l'environnement.

**Pour aller plus loin :** si tu veux voir le même soin apporté à une API tout entière, les articles de Hábil sur [les API prêtes pour les agents d'IA](https://www.habil.mx/fr/blog/apis-pretes-pour-agents-ia/), sur [la sécurité des API](https://www.habil.mx/fr/blog/securite-api-cto-identite-passerelle-jetons/) et sur [REST ou gRPC](https://www.habil.mx/fr/blog/rest-ou-grpc-quand-choisir-chacun/) continuent là où ce cours se termine.

## Le projet que tu vas construire

Le **`revisor`**, le programme qui vérifie l'état d'une liste de services — nom, état et temps de réponse —, avec **deux facettes** :

- Comme **serveur**, une petite API pour administrer la liste des services qu'il observe : enregistrer, consulter, modifier, retirer et demander une vérification. C'est la facette qui *produit* des erreurs, et elle doit bien les produire.
- Comme **client**, celui qui interroge les services et décide, d'après ce qu'ils répondent, s'ils sont disponibles, limités, en maintenance ou hors service, et si cela vaut la peine de réessayer. C'est la facette qui *lit* les erreurs.

C'est le même problème que dans les cours de Go, de Rust et de TypeScript de Hábil. Ce qui change, c'est la question : non pas « a-t-on pu consulter le service ? », mais « qu'a *dit* le service et que dois-je faire avec cela ? ». Et pour déclencher chaque code à volonté, la leçon 0 construit un serveur de test qui répond le code que tu lui demandes.

## Les neuf leçons

Il y en a neuf et non pas dix parce que le catalogue est restreint (23 codes) et qu'une seule spécification gouverne le corps de l'erreur. Les réponses de succès et les redirections partagent la leçon 1 parce que, dans une API, ce qu'elles ont de difficile relève des trois mêmes décisions.

| Leçon | | Ce que tu construis | Ce que tu apprends |
|---|---|---|---|
| 0 | [Le contrat qui voyage par HTTP](00-el-contrato-que-viaja.md) | le serveur de test et ton instrument : `curl -i` | ligne d'état, en-têtes et corps ; les cinq familles ; le code fait foi et le corps explique ; ce que fait une machine avec un code qu'elle ne connaît pas ; les registres officiels |
| 1 | [Succès et redirections : 200, 201, 202, 204, 301, 308 et 304](01-exitos-redirecciones.md) | les routes qui enregistrent, consultent et retirent des services ; la route héritée | renvoyer, créer, accepter ou ne rien renvoyer ; `Location` ; `202` et sa ressource de suivi ; `301` face à `308` ; `ETag` et `If-None-Match`. **Encadré de sécurité :** SSRF ; le `revisor` rejette le loopback, les réseaux privés, les adresses link-local ou de métadonnées et les ULA, le vérifie avant chaque connexion (après la résolution DNS), et le laboratoire n'admet qu'une exception pour une IP et un port exacts ; la défense complète contre le *DNS rebinding* arrive à la leçon 8 |
| 2 | [Le client s'est trompé (I) : 400, 401, 403, 404, 405 et 415](02-errores-del-cliente-peticion.md) | la porte d'entrée de l'API | sept étapes dans l'ordre : route → méthode → identifiant → permission → existence → format → lecture ; `WWW-Authenticate` et `Allow` ; quand un `404` dissimule délibérément ; le `413` de la limite de 16 Kio du corps (filet de sécurité, hors des 23). **Encadré de sécurité :** le `404` qui dissimule délibérément et l'énumération de ressources |
| 3 | [Le client s'est trompé (II) : 409, 410, 412, 422 et 428](03-errores-del-cliente-estado.md) | la modification d'un service sans écraser celui d'une autre personne | conflit, règle métier et précondition ; la mise à jour perdue ; `ETag` avec `If-Match` ; `410` face à `404` ; `400` face à `422` ; **versions d'API** : le retrait annoncé avant le `410`, avec `Deprecation` (RFC 9745) et `Sunset` (RFC 8594) |
| 4 | [Capacité et défaillances du serveur : 429, 500, 502, 503 et 504](04-capacidad-y-fallas-del-servidor.md) | limite de requêtes, maintenance et une dépendance lente | à qui la faute ; `Retry-After` ; `500`, `502` et `504` ; ce que l'on ne dit jamais dans une erreur de serveur. **Encadré de sécurité :** ce que l'on ne dit jamais dans une erreur, et le `429` comme défense |
| 5 | [Problem Details (RFC 9457)](05-problem-details.md) | le gestionnaire central d'erreurs | `application/problem+json` ; les cinq membres ; `type` stable ; extensions ; plusieurs problèmes ; de la RFC 7807 à la 9457 ; avec `about:blank`, le `title` est en anglais, car la RFC 9457 (§4.2.1) demande qu'il soit la phrase de statut (reason phrase) HTTP, tandis que `detail` peut être en espagnol |
| 6 | [Nouvelles tentatives et idempotence](06-reintentos-idempotencia.md) | un `POST` que l'on peut répéter sans doublon | méthodes sûres et idempotentes ; temporisation exponentielle avec *jitter* ; `Idempotency-Key` et pourquoi ce n'est pas encore un standard |
| 7 | [Celui qui lit l'erreur : le client du `revisor` et les agents d'IA](07-quien-lee-el-error.md) | la classification des réponses des services vérifiés | tableau de décision par code et par `type` ; corriger, réauthentifier, attendre, réconcilier ou abandonner ; comment un agent d'IA utilise ces mêmes champs |
| 8 | [Le contrat vérifiable](08-contrato-verificable.md) | la description OpenAPI et la matrice de 23 scénarios | documenter chaque erreur dans OpenAPI 3.1 ; le catalogue de types de problème ; la matrice `curl` complète ; les versions d'API dans OpenAPI |

À la fin de chaque leçon, il y a des exercices avec leurs solutions. Et le [journal de bord](bitacora.md) est à toi : note-y ce qui t'a donné du mal.

## Les 23 codes du cours

| Famille | Codes | Leçon |
|---|---|---|
| Succès | `200`, `201`, `202`, `204` | 1 |
| Redirection et cache | `301`, `308`, `304` | 1 |
| Le client s'est trompé : la requête | `400`, `401`, `403`, `404`, `405`, `415` | 2 |
| Le client s'est trompé : l'état | `409`, `410`, `412`, `422`, `428` | 3 |
| Capacité et défaillances du serveur | `429`, `500`, `502`, `503`, `504` | 4 |

D'autres apparaissent au passage, pour préciser en quoi ils se distinguent des précédents (`302`, `307`, `406`, `501`). Le `413` ne fait pas non plus partie des 23, mais le `revisor` le renvoie bien : c'est le filet de sécurité de la limite de 16 Kio du corps, que la leçon 2 explique avec le `415`. Pour chaque code, le cours t'enseigne **quand oui, quand non (et lequel mettre à la place) et la réponse minimale correcte**.

## Trois principes qui traversent tout le cours

**Le code fait foi et le corps explique, et les deux disent la même chose.** Le code d'état est ce que lit n'importe quelle machine sur le trajet — le navigateur, le cache, l'équilibreur de charge, le moniteur — ; le corps est destiné à qui a besoin du détail. Un corps qui contredit le code, ou qui s'y substitue, casse tout ce qui ne le lit pas.

**Une erreur bien conçue dit quoi faire.** Corriger la saisie, s'authentifier, attendre, relire l'état ou abandonner : la plupart du temps, celui qui reçoit l'erreur est un programme, et un programme ne devine pas. C'est pourquoi chaque leçon se termine par la question « que doit faire celui qui reçoit ceci ? ».

**Ce qui sort vers l'extérieur se conçoit.** Une erreur est une surface publique. Ce qui ne se dit pas — traces de pile, requêtes, chemins, noms de machines, clés — importe tout autant que ce qui se dit, et cela s'enseigne au moment où cela apparaît, pas dans un module final de sécurité.

**Par souci d'honnêteté :** `Idempotency-Key` et les en-têtes `RateLimit-*` **ne sont pas encore un standard** ; ils circulent sous forme de brouillons de l'IETF. Le cours les enseigne comme un motif que l'API documente et non comme une exigence de HTTP, et le rappelle chaque fois qu'ils apparaissent.

## Comment savoir que tu as terminé

Le cours ne se termine pas quand tu as lu la leçon 8, mais quand ton API remplit ces cinq conditions. Ce sont les mêmes que la vérification contrôle à chaque modification :

1. **La matrice de 23 scénarios s'exécute avec une seule commande**, et chaque ligne vérifie le code, les en-têtes obligatoires, le type de contenu et le corps.
2. **Aucune réponse d'erreur n'est un `200` ni du HTML.** Toutes sont en `application/problem+json` avec un `type` stable.
3. **Aucun corps d'un `5xx` ne contient de traces de pile, de requêtes, de chemins ni de clés.**
4. **Un `POST` répété avec la même clé ne duplique rien.** Si la même clé arrive avec un AUTRE corps, la réponse est `422` ; si elle arrive alors que la requête d'origine est encore en cours, la réponse est `409`. Cela vient du brouillon de l'IETF « The Idempotency-Key HTTP Header Field » (`draft-ietf-httpapi-idempotency-key-header-07`, expiré le 18 avril 2026), qui n'est PAS un standard.
5. **Le `revisor` classe les 23 cas avec un tableau** et ne réessaie pas ce qui ne doit pas être réessayé.

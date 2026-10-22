# Leçon 5 — Problem Details (RFC 9457)

Il est 3 h 20 un jeudi et le tableau de bord de l'équipe d'intégration affirme que le service `pagos` a disparu. Il n'a pas disparu : il est toujours dans le `revisor`, avec son id 2 habituel. Ce qui s'est passé est plus bête et plus coûteux. Il y a deux semaines, quelqu'un a écrit un script qui synchronise la liste des services avec le tableau de bord. Quand le `revisor` lui répond par une erreur, le script lit le corps, et s'il y trouve les mots « no existe », il supprime le service du tableau. Cette nuit, quelqu'un d'autre a modifié l'adresse de base du script et lui a retiré une lettre. Le `revisor` a répondu `404` avec « no existe esa ruta », le script a vu « no existe » et a supprimé les six services du tableau, un par un. Pendant ce temps, un autre script de la même équipe essaie d'enregistrer un service qui existe déjà, reçoit `409` avec « ya existe un servicio llamado pagos: /servicios/2 », coupe le texte au niveau des deux-points pour en extraire l'id… et hier quelqu'un a corrigé la formulation de ce message et lui a ajouté un point final. Désormais le script cherche le service `/servicios/2.`, qui n'existe pas, et recommence chaque seconde. Personne n'a rien fait de mal exprès. Les deux scripts ont lu des phrases parce que le `revisor` ne leur a donné rien d'autre à lire.

Cette leçon donne au `revisor` une seule façon de dire ce qui a mal tourné, celle que définit la RFC 9457, avec une partie pour les machines qui ne change jamais et une autre pour les personnes qui peut être rédigée comme on veut.

**Durée :** 90 min, ou 2 × 45 (la coupure se situe entre les sections 5.8 et 5.9)

**Ce que tu construis :** le gestionnaire central d'erreurs du `revisor`, `problemas.ts` : un catalogue avec un `type` stable pour chaque problème et une seule fonction, `fallar`, par laquelle passent toutes les erreurs de l'API ; et un programme qui vérifie que chaque erreur est un Problem Details bien formé

**Ce que tu apprends :** `application/problem+json` ; les cinq membres `type`, `title`, `status`, `detail` et `instance`, et à quoi sert chacun ; **`type` comme identifiant stable** ; `about:blank` et pourquoi son `title` est en anglais ; les extensions et leurs règles ; que faire lorsqu'une réponse contient plusieurs problèmes ; le registre officiel des types de l'IANA ; et ce qui a changé entre la RFC 7807 et la RFC 9457

**D'où tu viens.** De la [Leçon 4](04-capacidad-y-fallas-del-servidor.md), avec un `revisor` qui produit déjà tous les codes d'erreur du cours : ceux du point d'entrée de la Leçon 2, ceux d'état de la Leçon 3 et ceux de capacité et de pannes de la Leçon 4. Chaque code est bien choisi et porte ses en-têtes. Mais le corps de chaque erreur est une ligne de texte écrite manuellement à l'endroit où elle se produit, et chaque endroit l'écrit à sa façon. Cette leçon ne change aucun code ni aucun des en-têtes que chaque code exige (`Allow`, `WWW-Authenticate`, `Retry-After`, `Accept`) : elle change le corps de toutes les erreurs à la fois, et avec lui leur `Content-Type`.

**Ce que cette leçon ne fait pas.** Elle n'apprend pas à décider quoi faire d'une erreur côté client : ici, on conçoit ce que dit le `revisor`, et la [Leçon 7](07-quien-lee-el-error.md) écrit le programme qui le lit et qui décide. Elle ne documente pas les types dans OpenAPI et ne les vérifie pas à chaque modification ; cela, c'est la [Leçon 8](08-contrato-verificable.md). Et elle ne publie pas de pages de documentation aux adresses des `type` : le cours utilise un domaine réservé aux exemples, qui ne peut pas être visité, et la section 5.4 explique ce que tu ferais dans une véritable API.

**À propos des exécutions.** Linux Mint 22 est le système de référence du cours. Les sorties de cette leçon ont été obtenues le 21 octobre 2026 sous macOS avec Node 24.14.1 et curl 8.7.1, en ajoutant `-sS` à chaque `curl` parce que la sortie allait dans un fichier (`-s` désactive la barre de progression, `-S` laisse voir les erreurs, et aucune des deux ne change la réponse). Comme dans la Leçon 1, pendant la rédaction de cette leçon d'autres essais occupaient les ports 18080 et 18081 ; les exécutions ont donc été faites avec une copie des programmes identique aux ports près, 18580 et 18581, et dans les sorties collées ici on a réécrit 18080 et 18081, que tu vas taper toi-même. Les deux nombres ont le même nombre de chiffres, de sorte qu'aucun `Content-Length` ne change. Dans le terminal du `revisor`, le dossier de la machine a été remplacé par `<carpeta>`. Dans ton exécution, vont changer la date de `Date`, les huit chiffres finaux de chaque `ETag` (le `revisor` les tire au sort au démarrage) et la référence `urn:uuid:` de chaque erreur interne, qui est nouvelle à chaque occurrence, exprès (section 5.8). Le `revisor` garde tout en mémoire : pour obtenir la même chose que la leçon, redémarre-le avant chaque série de requêtes. Elle n'a pas été exécutée sur une installation de bureau de Mint, et rien de ce qui est utilisé ne dépend de macOS. Les programmes se trouvent dans [`programas/05-problem-details/`](../programas/05-problem-details), dans le dépôt du cours : le `revisor` dans `fig05_01/`, le vérificateur dans `fig05_02.ts`, les versions défectueuses de « L'erreur que tu vas voir » dans `defectos/`, la solution de l'exercice 4 dans `ejercicio4/`, l'exécution du `revisor` de la Leçon 4 dans `antes.salida.txt` et chaque exécution dans son fichier `.salida.txt`. Tous passent `tsc` en mode strict (section 5.16).

## À la fin, tu seras capable de

- Reconnaître un Problem Details à son `Content-Type` et nommer, sans regarder, ses cinq membres et ce que dit chacun.
- Décider pour une nouvelle erreur si elle mérite un `type` propre ou si `about:blank` suffit, et écrire son entrée dans le catalogue avec `type`, `title` et `status`.
- Expliquer pourquoi le `type` ne change jamais, ni d'une occurrence à l'autre ni d'une langue à l'autre, et pourquoi un client ne doit pas décider en lisant `title` ni `detail`.
- Ajouter une extension à un type de problème en respectant les règles de nommage de la RFC 9457, et vérifier par une exécution que le `revisor` rejette une extension dont le nom est réservé.
- Répondre à plusieurs problèmes du même type dans un seul corps, avec `errors` et `pointer`, et choisir lequel renvoyer lorsque les problèmes sont de types différents.
- Exécuter un programme qui vérifie que toutes les erreurs de l'API sont des Problem Details bien formés, et lire ses échecs sur deux versions volontairement cassées.

## Le pourquoi avant le comment

Les quatre leçons précédentes se sont occupées du code d'état, et à raison : c'est la partie du message que comprend n'importe quelle machine sur le chemin. Mais le code dit peu de chose. Un `404` dit « je n'ai pas trouvé ce que tu as demandé », et dans le `revisor` cela peut signifier que la route n'existe pas, que le service n'existe pas, que le service appartient à une autre équipe ou que la révision n'existe pas. Un `422` dit « j'ai compris, mais je ne peux pas l'exécuter », et ne dit pas quel champ a échoué. Un `409` dit « cela entre en conflit avec l'état actuel », et ne dit pas avec quoi. Le code commande, et pour beaucoup de décisions il suffit. Pour les autres, **le corps explique**, et la question de cette leçon est de savoir comment il explique.

Jusqu'à la Leçon 4, le `revisor` expliquait avec une ligne de texte. Cela a trois coûts, que la scène d'ouverture montre tous :

1. **Chaque erreur a sa propre forme.** Le `422` apporte une ligne par champ, séparées par des sauts de ligne ; le `409` apporte la route du service existant collée à la fin de la phrase ; le `500` apporte la référence à la fin d'une autre phrase. Un client qui veut exploiter cette information écrit un traducteur différent pour chaque erreur.
2. **Ce dont une machine a besoin est mélangé avec ce que lit une personne.** L'id du service en double est à l'intérieur d'une phrase. Pour l'en extraire, il faut couper le texte, et le jour où quelqu'un améliore la formulation, le client casse sans que le code d'état ait changé.
3. **Il n'y a pas de nom stable pour le problème.** « No existe el servicio 99 » et « no existe esa ruta » sont deux problèmes différents avec le même code, et la seule façon de les distinguer est de lire la phrase. Si demain le `revisor` est traduit en anglais, tous les clients qui lisaient des phrases cassent en même temps.

La RFC 9457 résout les trois choses avec un objet JSON de cinq membres. L'un d'eux, `type`, est un nom pour le problème qui ne change jamais, et c'est la seule chose dont une machine a besoin pour décider. Deux autres, `title` et `detail`, sont pour les personnes, et peuvent être rédigés et traduits comme on veut. Ce dont une machine a besoin en plus du nom — l'id du service en double, la liste des champs en échec — va dans des membres propres, les extensions, jamais à l'intérieur d'une phrase. Et le tout voyage avec un type de contenu propre, `application/problem+json`, pour que n'importe qui sache ce qu'il lit avant de l'ouvrir.

La leçon comporte quatre parties :

1. **Le format** (5.1 à 5.3) : ce qui change dans la réponse, le type de contenu et les cinq membres.
2. **Chaque membre en profondeur** (5.4 à 5.8) : `type` et `about:blank`, `title` et `detail`, `status`, `instance`.
3. **Au-delà des cinq** (5.9 à 5.12) : extensions, plusieurs problèmes, le registre de l'IANA et l'histoire du format.
4. **Le `revisor` complet** (5.13 à 5.16) : le gestionnaire central, les fichiers, l'exécution et le programme qui le vérifie.

## Les concepts

### 5.1 La même erreur, avant et après

Commence par voir le problème. Ces quatre requêtes sont adressées au `revisor` de la Leçon 4, tel que tu l'as laissé :

```text
$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 25
Date: Wed, 21 Oct 2026 13:18:39 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 99

$ curl -i -X PATCH http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, PUT, DELETE
Content-Type: text/plain; charset=utf-8
Content-Length: 35
Date: Wed, 21 Oct 2026 13:18:39 GMT
Connection: keep-alive
Keep-Alive: timeout=5

PATCH no se admite en /servicios/1

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"","url":"ftp://archivos","limite_ms":5}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 137
Date: Wed, 21 Oct 2026 13:18:39 GMT
Connection: keep-alive
Keep-Alive: timeout=5

nombre: debe ser un texto de 1 a 40 caracteres
url: debe ser una dirección http o https
limite_ms: debe ser un entero entre 100 y 10000

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: text/plain; charset=utf-8
Content-Length: 50
Date: Wed, 21 Oct 2026 13:18:39 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya existe un servicio llamado pagos: /servicios/2
```

Chaque réponse est correcte pour ce que demandait la Leçon 4 : bon code, bons en-têtes, une phrase claire. Mais regarde les corps comme les verrait un programme. Le premier est une phrase avec un nombre à l'intérieur. Le deuxième, une autre phrase avec une méthode et une route à l'intérieur. Le troisième, trois lignes dans un format propre, `campo: explicación`, qui n'apparaît dans aucune autre erreur. Le quatrième glisse une route à la fin de la phrase, après deux-points. Quatre erreurs, quatre formes, et toutes sont du `text/plain` : rien dans la réponse ne dit au client qu'il y a une structure exploitable.

Maintenant, la même première requête adressée au `revisor` de cette leçon :

```text
$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 174
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"El servicio no existe","status":404,"detail":"no existe el servicio 99","instance":"/servicios/99"}
```

Trois choses ont changé. Le `Content-Type` n'est plus `text/plain` mais `application/problem+json`. Est apparu `Content-Language: es`, qui indique dans quelle langue sont les parties destinées aux personnes. Et le corps est un objet JSON de cinq membres, toujours les mêmes cinq, dans toutes les erreurs que renvoie le `revisor`. Le code et sa phrase, `404 Not Found`, n'ont pas changé. **Le code continue de commander ; le corps explique désormais avec une structure qui se lit sans interpréter de phrases.**

Ce qui n'a pas changé compte aussi. La Leçon 4 a établi qu'une erreur du serveur ne porte ni traces de pile, ni chemins de la machine, ni secrets, et le nouveau format n'assouplit rien de cela : un Problem Details est une surface publique comme le texte d'avant, et la RFC 9457 elle-même le dit dans sa section 5 (section 5.8 de cette leçon).

### 5.2 `application/problem+json` : le type de contenu

La RFC 9457 définit le modèle d'un problème comme un objet JSON et, lorsque cet objet voyage comme document, lui attribue un type de contenu propre : `application/problem+json` (section 3). Il est inscrit au registre des types de contenu de l'IANA, qui renvoie aujourd'hui à la RFC 9457 : il n'a ni paramètres obligatoires ni paramètres facultatifs, et pour tout le reste il se comporte comme `application/json`. Le suffixe `+json` est une convention générale : il dit « ceci est du JSON avec une signification particulière ». Un programme qui ne connaît pas la signification peut le lire comme du JSON ; un programme qui la connaît sait, avant d'ouvrir le corps, qu'à l'intérieur il y a un problème avec `type`, `title` et les autres.

Pourquoi `application/json` ne suffit-il pas ? Parce que le type de contenu est la première chose que voit un client, et avec `application/json` il ne peut pas distinguer une erreur d'une ressource. Pense à un client générique qui reçoit un `404` d'une API qu'il ne connaît pas. Si le type est `application/problem+json`, il sait qu'il peut chercher `type` et `detail` et les afficher. Si c'est `application/json`, cela peut être un problème, une page de résultats vide avec sa propre forme, n'importe quoi. La section « L'erreur que tu vas voir » provoque justement cela : un corps parfait avec le mauvais type, et le programme qui vérifie les erreurs le rejette dans les treize cas.

Il existe une version XML, `application/problem+xml`, que la RFC définit dans son annexe B pour les API qui parlent XML. Le `revisor` parle JSON, il ne l'utilise donc pas.

La RFC ajoute un détail qu'il convient de connaître : son deuxième exemple, celui de `errors` et `pointer` qu'utilise le `revisor`, envoie `application/problem+json` alors que le client avait seulement demandé `Accept: application/json`, et précise que HTTP le permet (section 3, avec renvoi à la section 12.5.1 de la RFC 9110). La négociation de contenu est une préférence du client, non un ordre : la RFC 9110 dit dans sa section 12.4.1 que, si aucune représentation n'est acceptable selon un en-tête de négociation, le serveur peut répondre `406` ou ignorer cet en-tête. Pour une erreur, l'ignorer est presque toujours le mieux : un `406` à la place de l'explication de l'erreur laisse le client sans savoir ce qui a échoué. L'exercice 3 le vérifie avec le `revisor`.

### 5.3 Les cinq membres

Voici le corps de la réponse précédente, sur plusieurs lignes pour le lire plus facilement (c'est un fragment : le `revisor` l'envoie sur une seule ligne) :

```json
{
  "type": "https://revisor.example/problemas/servicio-inexistente",
  "title": "El servicio no existe",
  "status": 404,
  "detail": "no existe el servicio 99",
  "instance": "/servicios/99"
}
```

La RFC 9457 définit cinq membres dans la section 3.1, et ce tableau dit pour qui est chacun et à quelle question il répond :

| Membre | Type | Pour qui | Ce qu'il répond | Change-t-il d'une occurrence à l'autre ? |
|---|---|---|---|---|
| `type` | texte (un URI) | machines | quel est ce problème ? | jamais |
| `title` | texte | personnes | comment s'appelle ce problème ? | non, sauf pour la langue |
| `status` | nombre | machines qui ont perdu la ligne d'état | quel code le serveur a-t-il renvoyé ? | non dans le `revisor`, qui utilise un seul code par `type` (la RFC laisse un `type` en admettre plusieurs) |
| `detail` | texte | personnes | que s'est-il passé cette fois, et comment le corriger ? | oui |
| `instance` | texte (un URI) | le support | quelle occurrence était-ce ? | oui |

Les cinq sont facultatifs pour la RFC : un problème sans `type` vaut `about:blank` (section 3.1.1), et les autres peuvent manquer. **Le `revisor` envoie toujours les cinq**, dans le même ordre, dans toutes les erreurs qu'il renvoie lui-même (le `400` d'une méthode au nom absurde, comme `-X constructor`, est renvoyé par l'analyseur de Node avant que le `revisor` ne le voie, et c'est pourquoi il n'a pas de corps ; la section 5.14 le montre). C'est une décision de conception, non une norme : un client qui sait qu'ils sont toujours là n'a pas à écrire le cas où ils manquent, et une vérification automatique peut les exiger (le programme de la section 5.15 le fait).

La RFC a une règle pour celui qui lit qu'il vaut la peine d'apprendre tôt : **si un membre arrive avec un type qui n'est pas le sien, on l'ignore**, comme s'il n'était pas là (section 3.1). Un `status` qui arrive sous forme de texte, `"404"`, n'est pas un nombre, de sorte qu'un client qui suit la RFC fait comme s'il n'y avait pas de `status`. C'est une règle pensée pour qu'un client ne casse pas face à un serveur négligent, et c'est une raison de plus pour que le serveur soit soigneux : une erreur de type ne produit pas de message d'erreur, elle produit un membre qui disparaît en silence.

Les cinq sections qui suivent prennent chaque membre séparément.

### 5.4 `type` : l'identifiant stable

Regarde les deux premières réponses de l'exécution de cette leçon. La première demande un service qui n'existe pas ; la seconde, le service 3, qui existe mais appartient à l'équipe b, alors que celui qui demande est de l'équipe a :

```text
$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 174
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"El servicio no existe","status":404,"detail":"no existe el servicio 99","instance":"/servicios/99"}

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 172
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"El servicio no existe","status":404,"detail":"no existe el servicio 3","instance":"/servicios/3"}
```

Les deux ont le **même `type`** et le même `title`. Seuls `detail` et `instance` changent, et dans les deux cas seulement par le nombre. C'est ce que la Leçon 2 t'a demandé pour ne pas trahir quels services existent : le `404` qui dissimule volontairement doit être indiscernable du `404` de quelque chose qui n'existe pas, et la règle s'étend désormais aussi au `type`. Un `type` différent pour « c'est d'une autre équipe » serait la même fuite qu'un `403`, écrite ailleurs.

**Le `type` est le nom du problème, et c'est la seule chose avec laquelle une machine doit décider.** La RFC le dit avec un **doit** : celui qui consomme un problème doit utiliser le `type` comme identifiant principal du type de problème (section 3.1.1). Pas le `title`, qui est traduit. Pas le `detail`, qui change à chaque occurrence. Le `type`.

De là sort la règle qui donne son nom à cette section : **un `type` ne change jamais.** Il ne change pas d'une occurrence à l'autre : le service 99 et le service 3 donnent le même. Il ne change pas d'une langue à l'autre : si le `revisor` était traduit en anglais, `title` et `detail` changeraient, et le `type` resterait `https://revisor.example/problemas/servicio-inexistente`, avec ses mots en espagnol, car ce n'est pas un mot mais un identifiant. Et il ne change pas d'une version de l'API à l'autre : changer un `type` est une modification qui casse tous les clients qui décidaient avec lui, tout comme changer une route.

**Un `type` est un URI.** La RFC permet n'importe quelle référence d'URI, mais recommande qu'elle soit absolue (section 3.1.1). Un `type` relatif, comme `servicio-inexistente`, serait résolu par rapport à l'adresse de la requête, et le même mot signifierait deux choses différentes selon l'endroit où il a été demandé : la RFC donne justement cet exemple. Le `revisor` utilise des adresses absolues sous `https://revisor.example/problemas/`, plus la clé du problème.

**Si un `type` est une adresse `https`, la visiter devrait donner de la documentation** pour les personnes, qui explique le problème et comment le résoudre (section 3.1.1 et section 4 : « A problem type URI SHOULD resolve to HTML documentation »). Dans une véritable API, `https://tuapi.example.com/problemas/servicio-inexistente` serait une page qui dit quand il se produit, ce que signifie chaque extension et que faire. Le cours utilise `revisor.example` parce que `.example` est un domaine réservé à la documentation (RFC 6761), qui ne pointe vers aucune machine : ainsi aucun exemple du cours ne coïncide avec le domaine d'une entreprise réelle. Dans ton API, le `type` va sous un domaine que tu contrôles.

Deux autres règles de la RFC sur les `type` résolubles. La première : le client **ne devrait pas** visiter le `type` automatiquement, sauf pour informer la personne qui développe, par exemple avec un outil de débogage (section 3.1.1). Le `type` se compare, il ne se télécharge pas : un client qui demanderait la page à chaque erreur doublerait les requêtes et dépendrait de la disponibilité de la documentation. La seconde : la RFC permet un `type` qui ne peut pas être visité, comme un URI `tag:`, mais recommande les résolubles, car si un jour tu veux publier la documentation et que ton `type` n'était pas une adresse, tu devras le changer, et le changer casse tout le monde.

Et la question de conception de cette section : **quand un problème mérite-t-il un `type` propre ?** La RFC donne le critère dans la section 4 : les problèmes génériques, ceux qui pourraient arriver à n'importe quelle ressource du web, s'expriment mieux avec le code seul. Son exemple est un `403` sur un `PUT` : un type « tu ne peux pas écrire » n'ajoute rien que le code ne dise déjà. Un `type` propre vaut la peine quand le problème relève de ton domaine et que le client doit le distinguer d'autres avec le même code : « le service n'existe pas » face à « la révision n'existe pas » face à « la route n'existe pas », ou « les données ne peuvent pas être satisfaites » face à « le revisor ne se connecte pas à cette destination », qui sont les deux `422` du `revisor`.

### 5.5 `about:blank` : le problème qui n'est que son code

Quatre erreurs du `revisor` n'ont pas de `type` propre. En voici deux :

```text
$ curl -i http://127.0.0.1:18080/servicioss -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 111
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"about:blank","title":"Not Found","status":404,"detail":"no existe esa ruta","instance":"/servicioss"}

$ curl -i -X PATCH http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, PUT, DELETE
Content-Type: application/problem+json
Content-Language: es
Content-Length: 137
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"about:blank","title":"Method Not Allowed","status":405,"detail":"PATCH no se admite en /servicios/1","instance":"/servicios/1"}
```

Une route qui n'existe pas et une méthode que la route n'admet pas sont des problèmes de HTTP, pas du `revisor` : ils peuvent arriver à n'importe quelle API, et le code dit déjà tout ce qu'il y a à dire (avec `Allow`, dans le cas du `405`). C'est pour cela qu'existe `about:blank`. La RFC l'inscrit comme le seul type que le registre contient dès le départ, et dit qu'**un problème `about:blank` n'a pas d'autre signification que celle de son code d'état** (section 4.2.1). Les deux autres sont le `415`, un corps qui ne se déclare pas JSON, et le `413`, un corps de plus de 16 Kio, que tu verras dans l'exécution de la section 5.14.3 : ils peuvent arriver à n'importe quelle API, et le code, avec ses en-têtes, dit déjà tout.

`about:blank` est aussi la valeur par défaut : un problème sans `type` vaut comme s'il disait `about:blank` (sections 3.1.1 et 4.2.1). Le `revisor` l'écrit malgré tout, en vertu de la règle des cinq membres.

**Avec `about:blank`, le `title` est la phrase du code.** La RFC dit que le `title` **devrait** être la phrase recommandée pour ce code : `Not Found` pour `404`, et ainsi de suite (section 4.2.1). C'est pourquoi le `revisor` dit `Not Found`, `Method Not Allowed` et `Unsupported Media Type`, en anglais, même si tout le reste est en espagnol. La raison est qu'avec `about:blank` il n'y a pas de type propre pour nommer le problème : le nom du problème est le code, et le code a une phrase officielle, celle du registre des codes de l'IANA, que tout le monde reconnaît.

La même ligne de la RFC ajoute que cette phrase **peut** être traduite selon ce que demande le client avec `Accept-Language`. C'est une permission, non une obligation, et le `revisor` ne l'utilise pas : il laisse la phrase du registre telle quelle. Ce qui est bien en espagnol dans ces trois erreurs, c'est le `detail`, qui explique l'occurrence : « no existe esa ruta », « PATCH no se admite en /servicios/1 ». C'est toujours la même division : le nom, stable ; l'explication, pour celui qui lit.

Et n'est-il pas étrange d'envoyer `Content-Language: es` avec un `title` en anglais ? La RFC 9110 le prévoit : `Content-Language` décrit la langue du public auquel s'adresse la représentation, et dit que cela « peut ne pas être équivalent à toutes les langues utilisées » à l'intérieur de celle-ci (section 8.5). Le public du `revisor` lit l'espagnol ; qu'un nom propre de HTTP apparaisse en anglais ne change pas à qui il s'adresse.

Un détail de précision que le `revisor` résout dans `respuestas.ts` : Node apporte les anciens noms de deux codes, `413` et `422`, et le registre de l'IANA a les nouveaux, `Content Too Large` et `Unprocessable Content`. La ligne d'état utilise ceux du registre. Et le `413` du `revisor` est `about:blank`, de sorte que son `title` doit lui aussi être celui du registre, `Content Too Large`, et non le `Payload Too Large` qu'apporte Node : le catalogue l'écrit manuellement, et le programme de la section 5.15 le vérifie.

### 5.6 `title` et `detail` : ce qui se traduit

`title` et `detail` sont les deux membres destinés aux personnes, et ils ne diffèrent que sur un point : **`title` appartient au type et `detail` à l'occurrence.**

Le `title` est un résumé court du type de problème. La RFC dit qu'il **ne devrait pas** changer d'une occurrence à l'autre, sauf pour le traduire (section 3.1.3). « El servicio no existe » est le même pour le service 99, pour le 3 et pour celui que tu demanderas demain. C'est pourquoi dans le `revisor` le `title` vit dans le catalogue, à côté du `type`, et n'est pas écrit par celui qui répond : il est écrit une fois pour toutes par celui qui conçoit le type. La RFC ajoute que le `title` n'est qu'indicatif, pensé pour celui qui ne connaît pas la signification du `type` et ne peut pas la découvrir, par exemple en lisant un journal hors ligne.

Le `detail` explique **cette** occurrence : « no existe el servicio 99 ». La RFC lui demande deux choses (section 3.1.4). La première, qu'il se concentre sur l'aide au client pour corriger le problème, non sur des informations de débogage : « el servicio 5 no respondió en 1000 ms » lui dit ce qui s'est passé et lui suggère quoi changer (la limite du service) ; une trace de pile ne lui sert à rien et apprend au monde entier comment le serveur est fait. La seconde est une règle pour celui qui lit : **le client ne devrait pas interpréter le `detail` pour en tirer de l'information** ; pour cela il y a les extensions, qui sont « plus adaptées et moins sujettes aux erreurs ».

Cette seconde règle est la scène d'ouverture écrite sous forme de norme. Le `409` de la Leçon 4 disait « ya existe un servicio llamado pagos: /servicios/2 », et le script coupait la phrase. Compare avec celui de cette leçon :

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: application/problem+json
Content-Language: es
Content-Length: 219
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/nombre-repetido","title":"Ya existe un servicio con ese nombre","status":409,"detail":"ya existe un servicio llamado pagos","instance":"/servicios","existente":"/servicios/2"}
```

La route est sortie du `detail` et a déménagé dans son propre membre, `existente`. Le `detail` n'en a plus besoin et c'est une phrase propre, qu'on peut améliorer, raccourcir ou traduire sans casser personne. Le client qui a besoin du service existant lit `existente` et obtient `/servicios/2`, sans couper de texte. C'est l'extension de la section 5.9.

La division te permet aussi d'améliorer les textes sans demander la permission à personne. Imagine que le `title` de `etiqueta-vencida` dise « El servicio cambió desde que lo leíste ». Ce serait faux dans un cas : après un redémarrage, l'ancienne étiquette ne correspond pas non plus, même si personne n'a modifié le service. Le remplacer par « Tu etiqueta ya no es la vigente », qui est vrai dans les deux cas et qui est celui qu'utilise le `revisor`, ne casserait aucun client, parce que le `type`, `https://revisor.example/problemas/etiqueta-vencida`, resterait le même. Un `title` se corrige ; un `type` ne se touche pas.

**Ce qui se traduit et ce qui ne se traduit pas**, en une ligne : on traduit `title` et `detail` ; on ne traduit ni `type`, ni `status`, ni `instance`, ni les noms ni les valeurs des extensions. Le cours a des éditions dans d'autres langues, mais le code des programmes est copié sans être traduit : le `revisor` de toutes les éditions répond avec le `title` et le `detail` en espagnol, et le `type` est identique partout. Si un `revisor` était traduit, ces deux-là changeraient et le `type` resterait le même. Un client écrit contre l'édition en espagnol fonctionne de la même façon contre un `revisor` qui répondrait en bulgare, parce qu'il n'a jamais lu un seul mot.

### 5.7 `status` : le code, répété exprès

`status` est le code d'état, sous forme de nombre, le même que celui de la ligne d'état. Pourquoi le répéter ? La RFC donne deux raisons (section 3.1.2). Un intermédiaire, comme un cache ou un proxy, a pu changer le code en chemin, et le client peut voir quel était l'original. Et un problème peut être conservé sans sa réponse HTTP — dans un journal, dans une file, dans un courriel —, et là il n'y a plus de ligne d'état.

Mais il y a une règle stricte : celui qui génère le problème **doit** utiliser dans la réponse HTTP le même code que celui qu'il met dans `status`. Et le membre n'est qu'indicatif : le logiciel HTTP générique — proxies, répartiteurs de charge, pare-feu, antivirus — ne le connaît pas et ne le respecte pas, et continue d'utiliser le code de la ligne d'état (sections 3.1.2 et 5). **Si les deux diffèrent, c'est la ligne d'état qui l'emporte pour quiconque ne lit pas le corps**, ce qui représente presque tout le chemin. C'est le premier principe du cours énoncé dans un cas concret : le corps ne contredit jamais le code.

La RFC le place dans sa section sur la sécurité, et il vaut la peine d'en citer l'idée en entier : comme `status` duplique ce que dit déjà la ligne d'état, il est possible que les deux ne coïncident pas, et il n'est pas clair lequel a la priorité. C'est pourquoi dans le `revisor` il n'y a aucun moyen pour qu'ils diffèrent : le `status` sort du catalogue avec le `type`, et la même fonction qui écrit le corps écrit la ligne d'état avec ce nombre. Celui qui répond une erreur ne choisit pas le code : il choisit le problème, et le problème apporte son code.

### 5.8 `instance` : quelle occurrence c'était

`instance` est un URI qui identifie **cette occurrence** du problème (section 3.1.5). La RFC laisse ouvert l'URI à utiliser, et le `revisor` prend deux décisions différentes selon le cas.

**Dans les erreurs du client, `instance` est la route demandée, sans la requête** : `/servicios/99`, `/servicioss`, `/servicios`. Cela dit à celui qui lit le problème dans un journal à quelle ressource allait la requête. On retire la requête (ce qui vient après `?`) parce que des données qui ne doivent pas rester copiées dans une erreur y voyagent parfois. Attention : le terminal du `revisor` enregistre bien la requête complète, avec sa chaîne de requête ; dans une véritable API, le journal aussi tronque ou masque ce qui ne doit pas être conservé. Et c'est un choix de conception qu'il convient de dire en toutes lettres : il s'écarte un peu de la RFC. La RFC définit `instance` comme l'identifiant de **cette** occurrence, et dit que, si l'URI peut être visité, le problème devrait pouvoir y être obtenu (section 3.1.5). `/servicios/99` peut être visité, mais il renvoie la ressource (ou le même `404`), non cette occurrence ; et deux requêtes vers `/servicios/99` donnent le même `instance`. On l'utilise parce qu'il dit à celui qui lit un journal à quelle ressource allait la requête, et la RFC le laisse passer sur la forme : son propre exemple utilise une route (`/account/12345/msgs/abc`), et recommande qu'un URI relatif porte le chemin complet. Là où il importe d'identifier l'occurrence, dans le `500`, le `revisor` utilise une référence unique.

**Dans l'erreur interne, `instance` est une référence unique** :

```text
$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer escritura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json
Content-Language: es
Content-Length: 244
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/error-interno","title":"Error interno del revisor","status":500,"detail":"ocurrió un error inesperado; si se repite, reporta la referencia","instance":"urn:uuid:d80e7ef5-6cf9-4099-83a4-53c6d6116787"}
```

`urn:uuid:` suivi d'un identifiant universel unique (RFC 9562) est un URI qui ne peut pas être visité et dont la probabilité de se répéter est négligeable (122 bits au hasard : ce n'est pas impossible, c'est absurdement improbable). Chaque `500` en apporte un nouveau, et le même identifiant reste dans le terminal du `revisor`, avec la trace de pile :

```text
GET /servicios/1/informe
error d80e7ef5-6cf9-4099-83a4-53c6d6116787 en GET /servicios/1/informe: TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:314:28)
    at atender (file://<carpeta>/rutas.ts:107:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:23:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:38:44)
```

Voilà comment le support travaille avec une erreur du serveur : le client signale « j'ai reçu le `urn:uuid:…` », et celui qui exploite le service cherche ce texte dans son journal et trouve la trace de pile exacte, la route et l'heure. Le client ne reçoit pas la trace de pile et n'en a pas besoin. C'est la même référence que la Leçon 4 plaçait dans la phrase du `500`, désormais dans le membre que la RFC a conçu pour cela, et avec un `detail` qui ne la répète plus : « ocurrió un error inesperado; si se repite, reporta la referencia ».

La RFC suggère que, si l'`instance` peut être visitée, le problème complet puisse y être obtenu (section 3.1.5), et dans sa section sur la sécurité elle avertit que celui qui offre cette information par HTTP doit éviter d'exposer des détails de l'implémentation, comme un vidage de pile. Le `revisor` n'offre pas cette page : la trace de pile vit dans le terminal, que seul voit celui qui exploite le service.

**Voilà pour la première moitié.** Si tu travailles en deux séances, c'est ici la coupure.

### 5.9 Extensions : ce que le type ajoute

Un type de problème **peut** ajouter ses propres membres à l'objet (section 3.2). On les appelle des extensions, et ce sont l'endroit pour tout ce dont une machine a besoin en plus du nom du problème. Le `revisor` en a deux : `existente` dans le `409`, que tu as déjà vu, et `errors` dans le `422`, que tu verras dans la section 5.10.

**Une extension appartient au type, non à l'occurrence.** Elle est définie par celui qui conçoit le type, avec son `type`, son `title` et son `status`, et elle est documentée dans la page du `type`. `existente` est toujours présente dans un `nombre-repetido`, et c'est toujours la route du service qui porte déjà ce nom. Un client qui connaît le type sait qu'il peut compter sur elle.

**Le client doit ignorer les extensions qu'il ne connaît pas** (section 3.2). C'est la règle qui laisse les types évoluer : si demain le `revisor` ajoute à `nombre-repetido` une extension `sugerencia` avec un nom libre, les clients d'aujourd'hui continuent de fonctionner, car ils ne la cherchent pas. Pour la même raison, retirer une extension que les clients utilisent casse bel et bien : c'est comme retirer un champ d'une ressource.

**Le nom d'une extension obéit à des règles.** La RFC dit dans la section 4 que le nom **devrait** commencer par une lettre, n'utiliser que des lettres, des chiffres et le tiret bas, et comporter trois caractères ou plus. Les deux premières règles ont une raison que donne la RFC : que le nom puisse aussi s'écrire dans d'autres formats que JSON, comme XML. Celle des trois lettres, la RFC la demande sans l'expliquer ; c'est une recommandation (*SHOULD*), non une obligation. `existente` et `errors` la respectent. `ex` ne la respecterait pas (il a deux lettres) et `nombre-previo` non plus (il contient un tiret). L'exercice 4 te demande de faire en sorte que `problemas.ts` le vérifie.

**Et le nom ne peut pas être celui d'un membre standard.** Il y a ici un piège de JavaScript. `fallar` construit le corps avec `{ type, title, status, detail, instance, ...extensiones }` : d'abord les cinq, puis les extensions. Si quelqu'un passait une extension nommée `status`, le `...` l'écrirait par-dessus le `status` du catalogue, et le corps dirait un code différent de celui de la ligne d'état : le désaccord dont la section 5.7 disait qu'il ne pouvait pas se produire. C'est pourquoi `fallar` rejette les cinq noms réservés avant de construire le corps, en lançant une erreur. Cette erreur est attrapée par `servidor.ts` et convertie en `500` avec sa référence : c'est un défaut du programme, non du client, et ainsi on le voit dans le terminal au lieu de sortir comme une réponse qui ment.

Et les en-têtes ? `Retry-After` dans le `503`, `Allow` dans le `405`, `WWW-Authenticate` dans le `401` et `Accept` dans le `415` restent des en-têtes, non des extensions. La RFC le prévoit : une définition de type peut demander que la réponse porte `Retry-After` (section 4). Les en-têtes sont lus par le logiciel HTTP générique ; une extension n'est lue que par celui qui comprend le type. Ce que HTTP a déjà sous forme d'en-tête reste un en-tête, et c'est pourquoi `fallar` reçoit les en-têtes séparément des extensions.

### 5.10 Plusieurs problèmes dans une réponse

Une requête peut avoir plus d'un problème. La RFC distingue deux cas, et le `revisor` a les deux.

**Plusieurs problèmes du même type : une extension avec la liste.** Un enregistrement avec trois champs erronés a trois fois le même problème, « les données ne peuvent pas être satisfaites » :

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"","url":"ftp://archivos","limite_ms":5}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 407
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"3 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser un texto de 1 a 40 caracteres","pointer":"#/nombre"},{"detail":"debe ser una dirección http o https","pointer":"#/url"},{"detail":"debe ser un entero entre 100 y 10000","pointer":"#/limite_ms"}]}
```

Un seul problème `datos-invalidos`, avec une extension `errors` qui liste les trois échecs. Chaque échec est un objet avec son `detail`, qui explique ce qui ne va pas, et un `pointer`, qui dit où. C'est exactement la forme du deuxième exemple de la section 3 de la RFC 9457, qui définit un type de validation avec l'extension `errors` et dit que, lorsque le type est conçu pour cela, les extensions peuvent porter plus d'une occurrence du même problème. Le `detail` ci-dessus ne fait que compter combien d'échecs il y a : ce dont le client a besoin se trouve dans la liste.

Le `pointer` est un **JSON Pointer** (RFC 6901) : une façon standard de désigner un endroit à l'intérieur d'un document JSON. `#/nombre` est le membre `nombre` de l'objet racine ; `#/perfil/color` serait le membre `color` dans `perfil` ; `#/servicios/0` serait le premier élément de la liste `servicios`. Le `#` devant est la façon d'écrire le pointeur sous forme de fragment d'URI (section 6 de la RFC 6901), la même qu'utilise l'exemple de la RFC 9457. Avec cela, un formulaire peut placer chaque message à côté de son champ sans interpréter de phrases : le `pointer` dit lequel, le `detail` dit quoi.

Compare avec le `422` de la Leçon 4 : le même contenu, trois lignes `campo: explicación`. Là, le client devait couper le texte aux sauts de ligne et aux deux-points, et un message contenant des deux-points le cassait. Ici chaque élément est dans son membre.

**Plusieurs problèmes de types différents : on répond au plus pertinent.** Voyons maintenant un enregistrement avec un nom qui existe déjà et une adresse interdite :

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://169.254.169.254/latest/meta-data/"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 230
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 169.254.169.254:80: dirección privada o reservada","instance":"/servicios"}
```

`pagos` existe déjà, donc cet enregistrement a deux problèmes : `nombre-repetido` (`409`) et `destino-prohibido` (`422`). Le `revisor` ne répond qu'au second. La RFC dit que, lorsqu'une API rencontre plusieurs problèmes qui ne partagent pas le type, **il est recommandé** de répondre au plus pertinent ou au plus urgent (section 3). Et elle explique pourquoi on ne les regroupe pas : bien qu'on puisse inventer un type « lot » qui porterait des problèmes disparates, cela ne cadre pas avec HTTP. Elle a raison, à cause du code : une réponse n'a qu'un seul code d'état, et un `409` et un `422` ensemble ne peuvent pas s'exprimer avec un seul.

Lequel est le plus pertinent ? La RFC ne le décide pas ; c'est ton API qui le décide, et dans le `revisor` c'est l'ordre de ses questions qui le décide. D'abord le point d'entrée, avec les sept questions de la Leçon 2 ; ensuite, à l'intérieur de l'enregistrement, `validar` rassemble tous les échecs de données ; ensuite `destinoPermitido` vérifie l'adresse ; et à la fin on cherche un nom en double. Une adresse interdite est plus urgente qu'un nom en double pour une raison pratique : si le client changeait seulement le nom, il se heurterait de nouveau à l'adresse ; s'il change l'adresse, il se peut que le nom cesse de l'intéresser. L'exercice 2 te demande de prédire trois autres égalités.

### 5.11 Le catalogue et le registre de l'IANA

Le `revisor` possède vingt-deux types de problème, chacun avec sa clé, son `type`, son `title` et son `status`. Ils sont à un seul endroit, le catalogue de `problemas.ts` (section 5.13), et c'est la moitié de la valeur du format : au lieu de vingt-huit appels avec leur propre phrase répartis dans cinq fichiers, une table qui peut se lire, se réviser et se documenter d'un seul coup. La Leçon 8 la convertit en description OpenAPI de l'API.

La RFC 9457 demande que la définition d'un nouveau type documente trois choses : l'URI du type, un `title` court et le code avec lequel il est utilisé (section 4). Ce sont les trois colonnes du catalogue. Elle peut définir en outre des extensions et demander `Retry-After`, qui dans le `revisor` sont `existente`, `errors` et le `503` de maintenance.

Pour les types que beaucoup d'API pourraient partager, la RFC 9457 a créé un registre officiel à l'IANA, « HTTP Problem Types » (section 4.2). Sa politique est *Specification Required* : pour inscrire un type, il faut une spécification publiée de façon stable et libre, même si ce n'est pas obligatoirement une norme. Et il comporte une exclusion qui importe ici : les valeurs propres à un fabricant, à une application ou à une installation **ne** peuvent **pas** être inscrites. Les types du `revisor` sont propres à son application, ils vivent donc sous son propre domaine et n'iraient jamais au registre.

Au 21 octobre 2026, le registre compte six entrées (mis à jour pour la dernière fois le 26 juin 2026) :

| `type` | Nom | Code recommandé | Défini dans |
|---|---|---|---|
| `about:blank` | See HTTP Status Code | — | RFC 9457 |
| `…#date` | Date Not Acceptable | `400` | RFC 9458 |
| `…#ohttp-key` | Oblivious HTTP key configuration not acceptable | `400` | RFC 9458 |
| `…#digest-unsupported-algorithms` | Unsupported Hashing Algorithms | `400` | `draft-ietf-httpapi-digest-fields-problem-types`, déjà approuvé et en attente de son numéro de RFC |
| `…#digest-invalid-values` | Invalid Digest Values | `400` | le même document |
| `…#digest-mismatched-values` | Mismatched Digest Values | `400` | le même document |

Les points de suspension sont `https://iana.org/assignments/http-problem-types`, le préfixe que la RFC permet aux inscriptions d'utiliser, et dont elle avertit qu'il peut ne pas se résoudre en une page (section 4.2). Que le registre soit si petit dit quelque chose : presque tous les problèmes sont propres à une application, et pour les véritablement génériques le code d'état existe déjà avec `about:blank`. Avant d'inventer un type, regarde le registre : s'il y en a un qui convient, réutilise-le : c'est pour cela que le registre existe (« to promote reuse », section 4.2), et c'est ce que suggère l'exemple de la section 4.1.

### 5.12 De la RFC 7807 à la RFC 9457

Le format a plus d'histoire que son numéro. Il a commencé comme un brouillon individuel de Mark Nottingham, daté du 4 juillet 2012, *Indicating Details of Problems to Machines in HTTP*, avec un avertissement peu commun en première page : il n'était pas clair que définir le format améliorerait suffisamment les choses pour compenser le tort qu'il pouvait causer, et l'utiliser avant qu'il soit une RFC « peut t'exposer au ridicule ». Le risque qu'il voyait était le couplage : que les clients dépendent trop des détails de chaque API. Il l'a publié malgré tout parce que, disait-il, beaucoup de gens le faisaient déjà à leur manière.

Il a été publié comme **RFC 7807** en mars 2016, de Mark Nottingham et Erik Wilde, et pendant sept ans il a été la référence. En juillet 2023, il a été remplacé par la **RFC 9457**, des deux mêmes auteurs et de Sanjay Dalal, également norme proposée de l'IETF, qui déclare le 7807 obsolète. Son annexe D liste les changements, et ils sont trois :

1. **Le registre des types** (section 4.2) : le 7807 n'avait pas de lieu commun pour les types partagés ; le 9457 a créé celui de l'IANA et y a inscrit `about:blank`.
2. **Que faire avec plusieurs problèmes** (section 3) : l'extension avec la liste pour ceux du même type, et le plus pertinent pour ceux de types différents, avec l'exemple de `errors` et `pointer` qu'utilise le `revisor`.
3. **Les `type` qui ne peuvent pas être visités** (section 3.1.1) : quand un URI comme `tag:` est acceptable et pourquoi on préfère les résolubles.

Ce qui n'a pas changé, c'est presque tout : les cinq membres, leurs types, `application/problem+json` et `application/problem+xml`. Un problème écrit selon le 7807 est valide selon le 9457, et un client du 7807 lit sans changement ce qu'envoie le `revisor`. Il reste des traces de l'ancien nom : l'espace de noms du format XML est toujours `urn:ietf:rfc:7807`, et le schéma JSON de l'annexe A s'intitule encore « An RFC 7807 problem object ». Si tu vois une bibliothèque qui dit « RFC 7807 », elle produit presque toujours la même chose que cette leçon ; ce qui lui manque, le cas échéant, c'est le registre et le guide pour plusieurs problèmes.

### 5.13 Le gestionnaire central : `problemas.ts`

Tout ce qui précède tient dans un nouveau fichier de soixante lignes :

```ts
// fig05_01/problemas.ts — el manejador central de errores: cada error sale como Problem Details (RFC 9457).
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

Lis-le en trois parties.

**Le catalogue.** `CATALOGO` est un objet dont les clés sont les noms courts des problèmes (`servicio-inexistente`, `datos-invalidos`…) et dont les valeurs portent le `type`, le `title` et le `status`. Les quatre premiers utilisent `about:blank` avec la phrase du registre ; les autres, la base `https://revisor.example/problemas/` plus la clé. `satisfies Record<string, Tipo>` demande à TypeScript de vérifier que chaque entrée possède les trois champs avec le bon type, sans perdre les noms exacts des clés. C'est pourquoi `Clave`, le type de la deuxième ligne après le catalogue, est la liste exacte des clés : si quelqu'un appelle `fallar(respuesta, "servicio-inexsitente", …)` avec une lettre changée, `tsc` le signale avant d'exécuter quoi que ce soit.

**`fallar`.** Elle reçoit la réponse, la clé du problème, le `detail` de cette occurrence et des options : en-têtes, extensions et `instance`. Elle tire du catalogue le `type`, le `title` et le `status`, de sorte que celui qui l'appelle **ne peut pas** écrire un `status` différent du code, ni un `title` différent de celui du type. Elle rejette les extensions dont le nom est réservé (section 5.9). Elle calcule `instance` comme la route demandée sans la requête, sauf si l'appelant en envoie une autre (le `500`). Elle construit le corps avec les cinq membres d'abord et les extensions ensuite, et écrit la ligne d'état avec le même `status`, les en-têtes de l'appelant, le type `application/problem+json`, `Content-Language: es` et la longueur exacte en octets. `Content-Length` est calculé avec `Buffer.byteLength` et non avec `.length` parce que les accents occupent deux octets en UTF-8 : « revisión » a huit lettres et neuf octets.

**Ce qui n'y est pas.** `fallar` ne décide rien du problème : elle ne choisit pas le code, ne choisit pas le type, ne traduit pas. Elle convertit seulement une décision déjà prise (la clé) en une réponse. C'est l'idée d'un gestionnaire central : **chaque endroit du programme décide quel problème s'est produit, et un seul endroit décide comment on le dit.** Si demain le `revisor` devait négocier la langue, ou envoyer `application/problem+xml`, on modifierait ce fichier et aucun autre.

`respuestas.ts` perd son `fallar` de texte et exporte `escribirCabecera`, que `problemas.ts` utilise désormais aussi pour que la phrase de la ligne d'état soit celle du registre :

```ts
// fig05_01/respuestas.ts — las respuestas de éxito del revisor y la lectura del cuerpo. Los errores, en problemas.ts.
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

Dans les autres fichiers, chaque appel passe d'un code à une clé, et ce qui était des en-têtes passe dans l'option `cabeceras`. Par exemple, le `405` de `rutas.ts` (fragment) :

```ts
// Lección 4
fallar(respuesta, 405, `${peticion.method} no se admite en ${url.pathname}`, { Allow: permitidos(ruta) });
// Lección 5
fallar(respuesta, "metodo-no-admitido", `${peticion.method} no se admite en ${url.pathname}`, {
  cabeceras: { Allow: permitidos(ruta) },
});
```

Trois appels changent davantage que la forme, parce que l'information dont une machine a besoin sort de la phrase. Le `409` déplace la route vers l'extension `existente` ; le `422` remplace les lignes par la liste `errors` ; et le `500` déplace la référence vers `instance`. Tu les verras en entier dans la section 5.14.

### 5.14 Le `revisor` complet

#### 5.14.1 Les fichiers qui changent

Le `revisor` de cette leçon vit dans `~/curso-http/fig05_01/`. Si tu as le dossier de la Leçon 4, copie-le sous ce nom : outre `problemas.ts` et `respuestas.ts`, que tu as déjà vus en entier, cinq fichiers changent. Dans tous, les appels à `fallar` passent d'un code à une clé et l'`import` de `fallar` vient désormais de `problemas.ts`.

`servidor.ts` : le `500` porte la référence dans `instance`.

```ts
// fig05_01/servidor.ts — la cara servidor del revisor: la API que administra los servicios observados.
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

`rutas.ts` : le point d'entrée, avec `about:blank` pour la route et la méthode, et les types propres des identifiants et de la permission.

```ts
// fig05_01/rutas.ts — la puerta de la API: qué ruta existe, qué método admite y quién puede usarlo.
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

`servicios.ts` : `rechazarDatos` construit la liste `errors`, et les deux `409` portent `existente`.

```ts
// fig05_01/servicios.ts — lo que hace cada ruta de la API del revisor.
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
import { fallar } from "./problemas.ts";
import { CuerpoDemasiadoGrande, enviarJson, enviarVacio, leerCuerpo, TOPE_CUERPO, type Cabeceras } from "./respuestas.ts";

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
    fallar(respuesta, "nombre-repetido", `ya existe un servicio llamado ${validos.nombre}`, {
      extensiones: { existente: `/servicios/${existente.id}` },
    });
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
    terminarRevision(revision.id, await revisar(servicio.url, servicio.limiteMs));
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

`operacion.ts` : le `503` conserve son `Retry-After` comme en-tête ; le `403` de celui qui n'est pas admin utilise le même type que celui du point d'entrée.

```ts
// fig05_01/operacion.ts — el modo mantenimiento: lo enciende y lo apaga quien opera el revisor.
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

`versiones.ts` : la version retirée a son propre type, `version-retirada`, distinct de `servicio-retirado`, parce que le client doit faire des choses différentes : dans l'un, cesser de demander ce service ; dans l'autre, migrer vers une autre version de l'API.

```ts
// fig05_01/versiones.ts — las versiones viejas de la API: /v1 está desaprobada y /v0 ya se retiró.
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

#### 5.14.2 Les fichiers qui ne changent pas

Les autres fichiers sont ceux de la Leçon 4, sans la moindre modification. Ils sont donnés en entier pour que le `revisor` puisse être assemblé à partir de cette leçon :

```ts
// fig05_01/almacen.ts — los servicios que observa el revisor y las revisiones pedidas, en memoria.
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
// fig05_01/autenticacion.ts — quién eres (la credencial) y qué puedes hacer (el rol).
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
// fig05_01/cliente.ts — la cara cliente del revisor: consulta un servicio y clasifica lo que respondió.
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
// fig05_01/destinos.ts — a dónde puede conectarse el revisor. Defensa contra SSRF.
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
// fig05_01/etiquetas.ts — leer y comparar etiquetas (ETag) como pide el RFC 9110.
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
// fig05_01/laboratorio.ts
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
// fig05_01/limitador.ts — cuántas veces se puede hacer algo en una ventana de tiempo.
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

```json fig05_01/package.json
{
  "type": "module"
}
```

#### 5.14.3 L'exécution complète

Ouvre deux terminaux dans `~/curso-http/fig05_01/`. Dans le premier, le laboratoire ; dans le second, le `revisor` :

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

Dans un troisième, voici les requêtes de la leçon, dans l'ordre. Celles des sections précédentes sont ici à nouveau, rassemblées, et après elles viennent celles du 401, du 503 de maintenance, un succès, les deux rejets de SSRF et un corps trop grand :

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: application/problem+json
Content-Language: es
Content-Length: 172
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/credencial-invalida","title":"Falta una credencial válida","status":401,"detail":"falta la credencial","instance":"/servicios"}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: application/problem+json
Content-Language: es
Content-Length: 219
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/nombre-repetido","title":"Ya existe un servicio con ese nombre","status":409,"detail":"ya existe un servicio llamado pagos","instance":"/servicios","existente":"/servicios/2"}

$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer escritura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json
Content-Language: es
Content-Length: 244
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/error-interno","title":"Error interno del revisor","status":500,"detail":"ocurrió un error inesperado; si se repite, reporta la referencia","instance":"urn:uuid:d80e7ef5-6cf9-4099-83a4-53c6d6116787"}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"","url":"ftp://archivos","limite_ms":5}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 407
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"3 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser un texto de 1 a 40 caracteres","pointer":"#/nombre"},{"detail":"debe ser una dirección http o https","pointer":"#/url"},{"detail":"debe ser un entero entre 100 y 10000","pointer":"#/limite_ms"}]}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://169.254.169.254/latest/meta-data/"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 230
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 169.254.169.254:80: dirección privada o reservada","instance":"/servicios"}

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":true}'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a'
HTTP/1.1 503 Service Unavailable
Retry-After: 120
Content-Type: application/problem+json
Content-Language: es
Content-Length: 188
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/en-mantenimiento","title":"El revisor está en mantenimiento","status":503,"detail":"el revisor está en mantenimiento","instance":"/servicios"}

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":false}'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 200 OK
ETag: "1-1-f5a91511"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"metadatos","url":"http://169.254.169.254/latest/meta-data/"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 230
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 169.254.169.254:80: dirección privada o reservada","instance":"/servicios"}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"yo-mismo","url":"http://localhost:18080/mantenimiento"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 235
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: localhost resuelve a una dirección privada o reservada","instance":"/servicios"}

$ printf '{"nombre":"%017000d"}' 0 | curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' --data-binary @-
HTTP/1.1 413 Content Too Large
Connection: close
Content-Type: application/problem+json
Content-Language: es
Content-Length: 129
Date: Wed, 21 Oct 2026 23:42:15 GMT

{"type":"about:blank","title":"Content Too Large","status":413,"detail":"el cuerpo pasa de 16384 bytes","instance":"/servicios"}
```

Remarque cinq choses. Le `401` conserve son `WWW-Authenticate` et le `503` son `Retry-After` : les en-têtes que chaque code exige ne sont pas passés dans le corps. Le `413` de la fin, un enregistrement avec un nom de 17 000 caractères, est `about:blank` avec la phrase du registre, et porte `Connection: close` : le `revisor` cesse de lire dès que le corps dépasse 16 Kio et ferme la connexion en répondant, pour ne pas continuer à recevoir ce que le client voulait envoyer. Les `204` restent sans corps. Le succès, `GET /servicios/1`, reste `application/json`, sans `Content-Language` : le format ne concerne que les erreurs. Et les deux rejets de SSRF de la Leçon 1 ont maintenant leur type, `destino-prohibido`, avec le même `detail` qu'avant, qui n'énumère pas les adresses vers lesquelles un nom se résout.

#### 5.14.4 Le reste continue de fonctionner

Les requêtes conditionnelles, le schéma d'identification, la méthode au nom de `Object.prototype`, le corps qui n'est pas un objet, les plages de SSRF et l'étiquette après redémarrage n'ont pas changé de comportement : seulement de corps, quand ce sont des erreurs. Voici la même exécution, à la suite. Elle contient aussi le cas de la mise à jour perdue avec deux `PUT` simultanés qu'a vu la Leçon 3 : l'un lent, qui envoie son corps une seconde plus tard (`curl -T -` l'envoie par morceaux), et l'autre rapide avec la même étiquette. Entre l'avant-dernière et la dernière requête, le `revisor` a été redémarré :

```text
$ ETAG=$(curl -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'); echo "ETAG=$ETAG"
ETAG="1-1-f5a91511"

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H "If-None-Match: W/$ETAG"
HTTP/1.1 304 Not Modified
ETag: "1-1-f5a91511"
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H "If-None-Match: \"9-9\", $ETAG"
HTTP/1.1 304 Not Modified
ETag: "1-1-f5a91511"
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H 'If-None-Match: *'
HTTP/1.1 304 Not Modified
ETag: "1-1-f5a91511"
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H 'If-None-Match: "9-9", W/"8-8"'
HTTP/1.1 200 OK
ETag: "1-1-f5a91511"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: W/$ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 412 Precondition Failed
Content-Type: application/problem+json
Content-Language: es
Content-Length: 263
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/etiqueta-vencida","title":"Tu etiqueta ya no es la vigente","status":412,"detail":"If-Match se compara en fuerte: una etiqueta débil (W/) no sirve para cambiar; manda la ETag tal como llegó","instance":"/servicios/1"}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: \"9-9\", $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-2-f5a91511"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: *' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-3-f5a91511"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ ETAG=$(curl -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ETAG=$ETAG"
ETAG="1-3-f5a91511"

$ ( sleep 1; printf '%s' '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1000}' ) | curl -w 'lenta: %{http_code}\n' -X PUT -T - http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" & LENTA=$!; sleep 0.3; curl -o /dev/null -w 'rápida: %{http_code}\n' -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}'; wait $LENTA
rápida: 200
{"type":"https://revisor.example/problemas/etiqueta-vencida","title":"Tu etiqueta ya no es la vigente","status":412,"detail":"el servicio cambió mientras se atendía tu petición; vuelve a leerlo antes de cambiarlo","instance":"/servicios/1"}
lenta: 412

$ curl http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}

$ curl -o /dev/null -w 'text/plain con etiqueta vieja: %{http_code}\n' -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -H 'If-Match: "1-0-0"' -d 'catalogo'
text/plain con etiqueta vieja: 415

$ curl -o /dev/null -w 'text/plain sin If-Match: %{http_code}\n' -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -d 'catalogo'
text/plain sin If-Match: 415

$ ID=$(curl -o /dev/null -w '%header{location}' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"efimero","url":"http://127.0.0.1:18081/codigo/200"}'); ETAG=$(curl -o /dev/null -w '%header{etag}' http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a'); echo "ID=$ID ETAG=$ETAG"
ID=/servicios/7 ETAG="7-1-f5a91511"

$ ( sleep 1; printf '%s' '{"nombre":"efimero","url":"http://127.0.0.1:18081/codigo/200"}' ) | curl -w ' <- PUT lento: %{http_code}\n' -X PUT -T - http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" & LENTO=$!; sleep 0.3; curl -o /dev/null -w 'DELETE en el hueco: %{http_code}\n' -X DELETE http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a'; wait $LENTO
DELETE en el hueco: 204
{"type":"https://revisor.example/problemas/servicio-retirado","title":"El servicio se retiró","status":410,"detail":"el servicio 7 se retiró y no va a volver","instance":"/servicios/7"}
 <- PUT lento: 410

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 454
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/lento/1500","limite_ms":2000},{"id":5,"nombre":"reportes","url":"http://127.0.0.1:18081/lento/3000","limite_ms":1000},{"id":6,"nombre":"facturacion","url":"http://127.0.0.1:18081/basura","limite_ms":2000}]}

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Basic bGVjdHVyYS1hOg=='
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: application/problem+json
Content-Language: es
Content-Length: 185
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/credencial-invalida","title":"Falta una credencial válida","status":401,"detail":"solo se admite el esquema Bearer","instance":"/servicios"}

$ curl -i -X constructor http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 400 Bad Request
Connection: close

$ head -c 20000 /dev/zero | tr '\0' 'a' | curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' --data-binary @-
HTTP/1.1 413 Content Too Large
Connection: close
Content-Type: application/problem+json
Content-Language: es
Content-Length: 129
Date: Wed, 21 Oct 2026 23:42:15 GMT

{"type":"about:blank","title":"Content Too Large","status":413,"detail":"el cuerpo pasa de 16384 bytes","instance":"/servicios"}

$ head -c 20000 /dev/zero | tr '\0' 'a' | curl -o /dev/null -w 'por partes: %{http_code}\n' -X POST -T - http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json'
por partes: 413

$ head -c 16384 /dev/zero | tr '\0' 'a' | curl -o /dev/null -w 'en el tope: %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' --data-binary @-
en el tope: 400

$ curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
200

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d 'null'
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json
Content-Language: es
Content-Length: 177
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/cuerpo-ilegible","title":"El cuerpo no se puede leer","status":400,"detail":"el cuerpo no es un objeto JSON","instance":"/servicios"}

$ curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
200

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-1","url":"http://100.100.100.200/latest/meta-data/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 100.100.100.200:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-2","url":"http://[64:ff9b::a9fe:a9fe]/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: [64:ff9b::a9fe:a9fe]:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-3","url":"http://224.0.0.1/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 224.0.0.1:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-4","url":"http://[ff02::1]/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: [ff02::1]:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-5","url":"http://[2002:a9fe:a9fe::]/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: [2002:a9fe:a9fe::]:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-6","url":"http://[::7f00:1]/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: [::7f00:1]:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-7","url":"http://[64:ff9b:1::a9fe:a9fe]/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: [64:ff9b:1::a9fe:a9fe]:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-8","url":"http://240.0.0.1/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 240.0.0.1:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-9","url":"http://198.18.0.1/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 198.18.0.1:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-10","url":"http://192.0.2.1/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 192.0.2.1:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-11","url":"http://[2001:db8::1]/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: [2001:db8::1]:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-12","url":"http://[2001:0:4136:e378:8000:63bf:3fff:fdd2]/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: [2001:0:4136:e378:8000:63bf:3fff:fdd2]:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ for i in 1 2 3 4; do curl -o /dev/null -w '%{http_code} %header{retry-after}\n' http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'; done
200 
200 
200 
429 60

$ for i in 1 2 3 4 5 6; do curl -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:18080/servicios/$i/revisiones -H 'Authorization: Bearer escritura-b'; done; echo
404 404 202 429 429 429 

$ ID=$(curl -o /dev/null -w '%header{location}' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"cortado","url":"http://127.0.0.1:18081/cortar"}'); echo "ID=$ID"
ID=/servicios/8

$ curl -i http://127.0.0.1:18080$ID/salud -H 'Authorization: Bearer admin'
HTTP/1.1 502 Bad Gateway
Content-Type: application/problem+json
Content-Language: es
Content-Length: 278
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/respuesta-invalida","title":"El servicio no dio una respuesta HTTP válida","status":502,"detail":"el servicio 8 no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP","instance":"/servicios/8/salud"}

$ TZ=America/Mexico_City node --input-type=module -e 'import { segundosDeEspera } from "./cliente.ts"; for (const v of ["120", "1.5", "-1", "12 30"]) console.log(JSON.stringify(v), "->", segundosDeEspera(v)); const imf = segundosDeEspera("Fri, 01 Jan 2100 00:00:00 GMT"), asc = segundosDeEspera("Fri Jan  1 00:00:00 2100"); console.log("asctime menos IMF-fixdate (misma fecha):", asc - imf, "s")'
"120" -> 120
"1.5" -> null
"-1" -> null
"12 30" -> null
asctime menos IMF-fixdate (misma fecha): 0 s

$ ANTES=$(curl -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b'); echo "ANTES=$ANTES"
ANTES="3-1-f5a91511"

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b' -H "If-None-Match: $ANTES"
HTTP/1.1 200 OK
ETag: "3-1-b32db61c"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 13:18:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

Les deux `412` — celui de l'étiquette faible et celui de la requête lente, qui a perdu la course — portent le même `type` et le même `title`, « Tu etiqueta ya no es la vigente », et seul leur `detail` raconte ce qui s'est passé dans chaque cas ; la modification qui est restée est celle de la rapide, `"limite_ms":3000`. Le `401` du schéma `Basic` porte déjà son type ; le `400` de `null` est `cuerpo-ilegible` ; les douze plages donnent `destino-prohibido` avec `[422]`. Le `400` de `-X constructor` reste sans corps parce que ce n'est pas le `revisor` qui le renvoie mais Node, avant de l'appeler, comme l'a expliqué la Leçon 2. La modification avec `text/plain` donne `415` même si elle porte une vieille étiquette ou aucune : le format est interrogé avant la condition, car la RFC 9110 dit que les préconditions ne sont pas évaluées si, sans elles, la réponse n'aurait été ni `2xx` ni `412` (section 13.2.1). Un `PUT` lent vers un service qu'une autre requête retire entre-temps donne `410` `servicio-retirado`, comme s'il était arrivé après le retrait. Les corps de 20 000 octets donnent `413`, avec `Content-Length` ou par morceaux, et un corps de 16 384 octets exactement est bien lu (et donne `400`, parce que ce n'est pas du JSON). L'interrogation en direct a sa propre limite, `demasiadas-consultas`, avec `Retry-After: 60`, distincte de celle des révisions. Le `502` d'un service qui coupe la connexion dit maintenant dans son `title` ce qui s'est vraiment passé : « El servicio no dio una respuesta HTTP válida », vrai aussi bien s'il a coupé que s'il a répondu quelque chose qui n'est pas du HTTP. Et la vieille étiquette, après redémarrage, donne `200` et non un faux `304`.

Le terminal du `revisor`, à la fin de toute l'exécution, avec les deux références d'erreur interne (celle de la section 5.8 et celle du programme de 5.15) :

```text
revisor en http://127.0.0.1:18080
GET /servicios/99
GET /servicios/3
GET /servicioss
PATCH /servicios/1
GET /servicios
POST /servicios
GET /servicios/1/informe
error d80e7ef5-6cf9-4099-83a4-53c6d6116787 en GET /servicios/1/informe: TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:314:28)
    at atender (file://<carpeta>/rutas.ts:107:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:23:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:38:44)
POST /servicios
POST /servicios
PUT /mantenimiento
operación: mantenimiento encendido
GET /servicios
PUT /mantenimiento
operación: mantenimiento apagado
GET /servicios/1
POST /servicios
POST /servicios
POST /servicios
GET /servicios/99
GET /servicios/3
GET /revisiones/99
GET /servicioss
PATCH /servicios/1
GET /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
PUT /servicios/1
GET /v0/servicios
GET /servicios/1/informe
error 260fe541-4a99-4e15-a886-6907979f5e48 en GET /servicios/1/informe: TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:314:28)
    at atender (file://<carpeta>/rutas.ts:107:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:23:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:38:44)
GET /servicios/1
GET /servicios/1
GET /servicios/1
GET /servicios/1
GET /servicios/1
PUT /servicios/1
PUT /servicios/1
PUT /servicios/1
GET /servicios/1
PUT /servicios/1
PUT /servicios/1
GET /servicios/1
PUT /servicios/1
PUT /servicios/1
POST /servicios
GET /servicios/7
PUT /servicios/7
DELETE /servicios/7
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
GET /servicios/1/salud
GET /servicios/1/salud
GET /servicios/1/salud
GET /servicios/1/salud
POST /servicios/1/revisiones
POST /servicios/2/revisiones
POST /servicios/3/revisiones
POST /servicios/4/revisiones
POST /servicios/5/revisiones
POST /servicios/6/revisiones
POST /servicios
GET /servicios/8/salud
GET /servicios/3
revisor en http://127.0.0.1:18080
GET /servicios/3
```

### 5.15 Le vérifier avec un programme

Regarder treize réponses à l'œil nu pour voir si elles respectent le format est ennuyeux et on s'y trompe. Ce programme le fait pour toi : il demande treize erreurs différentes au `revisor` et vérifie dans chacune ce que disent les sections précédentes.

```ts
// fig05_02.ts — comprueba que cada error del revisor sea un Problem Details bien formado (RFC 9457).
// Uso: node fig05_02.ts [base]     (por omisión, http://127.0.0.1:18080)
import { STATUS_CODES } from "node:http";

const BASE = process.argv[2] ?? "http://127.0.0.1:18080";
const MIEMBROS = ["type", "title", "status", "detail", "instance"];
// Node trae los nombres viejos de estos dos códigos; el registro de la IANA, los nuevos.
const FRASES: Record<number, string> = { 413: "Content Too Large", 422: "Unprocessable Content" };

type Caso = { nombre: string; metodo: string; ruta: string; cabeceras?: Record<string, string>; cuerpo?: string };

const escritor = { Authorization: "Bearer escritura-a" };
const json = { ...escritor, "Content-Type": "application/json" };

const CASOS: Caso[] = [
  { nombre: "servicio que no existe", metodo: "GET", ruta: "/servicios/99", cabeceras: escritor },
  { nombre: "servicio de otro equipo", metodo: "GET", ruta: "/servicios/3", cabeceras: escritor },
  { nombre: "revisión que no existe", metodo: "GET", ruta: "/revisiones/99", cabeceras: escritor },
  { nombre: "ruta que no existe", metodo: "GET", ruta: "/servicioss", cabeceras: escritor },
  { nombre: "método que la ruta no admite", metodo: "PATCH", ruta: "/servicios/1", cabeceras: escritor },
  { nombre: "sin credencial", metodo: "GET", ruta: "/servicios" },
  { nombre: "cuerpo en texto", metodo: "POST", ruta: "/servicios", cabeceras: { ...escritor, "Content-Type": "text/plain" }, cuerpo: "x" },
  { nombre: "cuerpo de más de 16 KiB", metodo: "POST", ruta: "/servicios", cabeceras: json, cuerpo: `{"nombre":"${"a".repeat(17_000)}"}` },
  { nombre: "datos imposibles", metodo: "POST", ruta: "/servicios", cabeceras: json, cuerpo: '{"nombre":"","url":"ftp://x"}' },
  { nombre: "nombre repetido", metodo: "POST", ruta: "/servicios", cabeceras: json, cuerpo: '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}' },
  { nombre: "cambio sin If-Match", metodo: "PUT", ruta: "/servicios/1", cabeceras: json, cuerpo: "{}" },
  { nombre: "versión retirada", metodo: "GET", ruta: "/v0/servicios", cabeceras: escritor },
  { nombre: "error interno", metodo: "GET", ruta: "/servicios/1/informe", cabeceras: escritor },
];

// Lo que el revisor ya respondió para cada type: el title y el status no deben cambiar entre ocurrencias.
const vistos = new Map<string, { title: unknown; status: unknown }>();

async function comprobar(caso: Caso): Promise<string[]> {
  const respuesta = await fetch(BASE + caso.ruta, { method: caso.metodo, headers: caso.cabeceras, body: caso.cuerpo });
  const fallas: string[] = [];
  const tipo = (respuesta.headers.get("content-type") ?? "").split(";")[0].trim();
  if (tipo !== "application/problem+json") fallas.push(`tipo ${tipo || "(ninguno)"}, se esperaba application/problem+json`);
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(await respuesta.text());
  } catch {
    return [...fallas, "el cuerpo no es JSON"];
  }
  if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) return [...fallas, "el cuerpo no es un objeto"];
  const problema = cuerpo as Record<string, unknown>;
  for (const miembro of MIEMBROS) {
    if (!Object.hasOwn(problema, miembro)) fallas.push(`falta ${miembro}`);
  }
  // status: un número, y el mismo que la línea de estado (RFC 9457, sección 3.1.2).
  if (problema.status !== respuesta.status) fallas.push(`status ${JSON.stringify(problema.status)} en el cuerpo y ${respuesta.status} en la línea`);
  // type: about:blank o un URI absoluto (sección 3.1.1 recomienda absolutos).
  const type = problema.type;
  if (typeof type !== "string") {
    fallas.push("type no es un texto");
  } else if (type !== "about:blank" && !URL.canParse(type)) {
    fallas.push(`type ${type} no es un URI absoluto`);
  }
  // Con about:blank, el title es la frase del código (sección 4.2.1).
  const frase = FRASES[respuesta.status] ?? STATUS_CODES[respuesta.status];
  if (type === "about:blank" && problema.title !== frase) fallas.push(`title ${JSON.stringify(problema.title)} con about:blank; se esperaba ${frase}`);
  // El mismo type, el mismo title y el mismo status en cada ocurrencia (sección 3.1.3).
  if (typeof type === "string" && type !== "about:blank") {
    const antes = vistos.get(type);
    if (antes === undefined) vistos.set(type, { title: problema.title, status: problema.status });
    else if (antes.title !== problema.title || antes.status !== problema.status) fallas.push(`${type} cambió de title o de status entre ocurrencias`);
  }
  return fallas;
}

let bien = 0;
for (const caso of CASOS) {
  const fallas = await comprobar(caso);
  if (fallas.length === 0) bien++;
  console.log(`${fallas.length === 0 ? "ok   " : "FALLA"} ${caso.metodo} ${caso.ruta} (${caso.nombre})${fallas.map((f) => "\n      " + f).join("")}`);
}
console.log(`\n${bien} de ${CASOS.length} respuestas son Problem Details bien formados`);
process.exitCode = bien === CASOS.length ? 0 : 1;
```

Pour chaque cas, il vérifie six choses : que le type de contenu soit `application/problem+json` ; que le corps soit un objet JSON ; que les cinq membres soient présents ; que `status` soit égal au code de la ligne d'état ; que `type` soit `about:blank` ou un URI absolu (`URL.canParse` dit si un texte peut être lu comme une adresse complète) ; et que, avec `about:blank`, le `title` soit la phrase du code. De plus, il tient le compte de ce qu'il a vu pour chaque `type` : si le même `type` apparaît deux fois avec un `title` ou un `status` différent, il le signale. Il se termine par 0 si tout va bien et par 1 si quelque chose échoue, pour pouvoir être utilisé dans une vérification automatique.

Avec le `revisor` en marche, dans un autre terminal (le programme se trouve dans le dossier du dessus, `~/curso-http/`) :

```text
$ node fig05_02.ts
ok    GET /servicios/99 (servicio que no existe)
ok    GET /servicios/3 (servicio de otro equipo)
ok    GET /revisiones/99 (revisión que no existe)
ok    GET /servicioss (ruta que no existe)
ok    PATCH /servicios/1 (método que la ruta no admite)
ok    GET /servicios (sin credencial)
ok    POST /servicios (cuerpo en texto)
ok    POST /servicios (cuerpo de más de 16 KiB)
ok    POST /servicios (datos imposibles)
ok    POST /servicios (nombre repetido)
ok    PUT /servicios/1 (cambio sin If-Match)
ok    GET /v0/servicios (versión retirada)
ok    GET /servicios/1/informe (error interno)

13 de 13 respuestas son Problem Details bien formados
```

Treize sur treize. Ce programme est la graine de la matrice de la Leçon 8, qui fait la même chose avec les 23 codes du cours et vérifie aussi les en-têtes.

### 5.16 Vérifier les types avec `tsc` (facultatif)

Depuis le dossier du `revisor`, avec la commande de la section 0.9 de la Leçon 0 plus `--allowImportingTsExtensions` :

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

Il n'affiche rien : il n'y a pas d'erreurs. `fig05_02.ts` passe la même commande avec les fichiers du `revisor`, ainsi que les deux versions cassées de la section suivante et la solution de l'exercice 4. Si tu changes une lettre d'une clé dans un appel à `fallar`, `tsc` le signale : c'est l'avantage de faire de `Clave` la liste exacte des clés du catalogue.

## L'erreur que tu vas voir

### Le `title` qui raconte l'occurrence

L'erreur la plus courante avec ce format est d'utiliser `title` comme s'il était `detail` : mettre dans le titre le message de cette occurrence. Cela se lit très naturellement, parce que beaucoup de bibliothèques appellent « message » ou « titre » la même chose. Pour la provoquer, copie `fig05_01/` sous le nom `rota/` et change dans `rota/problemas.ts` le début de `fallar` par ceci (c'est un fragment ; la version complète se trouve dans `defectos/title-por-ocurrencia/problemas.ts`) :

```ts
  // DEFECTO A PROPÓSITO (lección 5): el title lleva el mensaje de esta ocurrencia, como el detail.
  const { type, status } = CATALOGO[clave];
  const title = detail;
```

Démarre le laboratoire et le `revisor` depuis `rota/` et demande les deux services de la section 5.4 :

```text
$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 177
Date: Wed, 21 Oct 2026 13:18:31 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"no existe el servicio 99","status":404,"detail":"no existe el servicio 99","instance":"/servicios/99"}

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 174
Date: Wed, 21 Oct 2026 13:18:31 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"no existe el servicio 3","status":404,"detail":"no existe el servicio 3","instance":"/servicios/3"}
```

Chaque réponse, prise seule, semble correcte : les cinq membres sont là, le `type` est celui de toujours, le code est correct. Le problème apparaît quand on les compare : le même `type` apporte deux `title` différents, et la RFC dit que le `title` ne devrait pas changer d'une occurrence à l'autre. Un client qui regrouperait ses erreurs par `title` dans un tableau de bord verrait une ligne par service introuvable, au lieu d'une seule. Et le `title` ne sert plus à ce pour quoi il existe : dire à celui qui lit un journal quel *type* de problème c'est. Le programme de 5.15 le détecte :

```text
$ node fig05_02.ts
ok    GET /servicios/99 (servicio que no existe)
FALLA GET /servicios/3 (servicio de otro equipo)
      https://revisor.example/problemas/servicio-inexistente cambió de title o de status entre ocurrencias
ok    GET /revisiones/99 (revisión que no existe)
FALLA GET /servicioss (ruta que no existe)
      title "no existe esa ruta" con about:blank; se esperaba Not Found
FALLA PATCH /servicios/1 (método que la ruta no admite)
      title "PATCH no se admite en /servicios/1" con about:blank; se esperaba Method Not Allowed
ok    GET /servicios (sin credencial)
FALLA POST /servicios (cuerpo en texto)
      title "el cuerpo debe ser application/json, no text/plain" con about:blank; se esperaba Unsupported Media Type
FALLA POST /servicios (cuerpo de más de 16 KiB)
      title "el cuerpo pasa de 16384 bytes" con about:blank; se esperaba Content Too Large
ok    POST /servicios (datos imposibles)
ok    POST /servicios (nombre repetido)
ok    PUT /servicios/1 (cambio sin If-Match)
ok    GET /v0/servicios (versión retirada)
ok    GET /servicios/1/informe (error interno)

8 de 13 respuestas son Problem Details bien formados
```

Cinq échecs, de deux sortes. La première est celle du `title` qui a changé entre le service 99 et le 3. Les quatre autres sont les `about:blank`, dont le `title` n'est plus la phrase du code. Et regarde ce qu'il n'a **pas** trouvé : huit cas sont passés, bien qu'ils aient tous le même défaut. Le programme ne peut voir qu'un `title` change que lorsque le même `type` apparaît deux fois, et dans sa liste seul `servicio-inexistente` se répète. **Une vérification ne voit que ce qu'elle compare.** La correction consiste à revenir au catalogue : le `title` appartient au type et il est écrit par celui qui conçoit le type, une fois pour toutes. Arrête les programmes de `rota/` quand tu as terminé.

### Le problème qui prétend être du JSON

La deuxième erreur est plus petite et plus nuisible. Copie à nouveau `fig05_01/` sous le nom `rota2/` et change dans `rota2/problemas.ts` le type de contenu (la version complète se trouve dans `defectos/json-a-secas/problemas.ts`) :

```ts
    // DEFECTO A PROPÓSITO (lección 5): el cuerpo es un Problem Details, pero el tipo dice JSON a secas.
    "Content-Type": "application/json",
```

```text
$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/json
Content-Language: es
Content-Length: 174
Date: Wed, 21 Oct 2026 13:18:32 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"El servicio no existe","status":404,"detail":"no existe el servicio 99","instance":"/servicios/99"}
```

Le corps est identique, octet pour octet, à celui de la section 5.1. Une seule ligne des en-têtes a changé. Mais un client générique qui décide « est-ce un problème ? » en regardant le type de contenu — ce que la section 5.2 a dit que le type propre permet — ne le reconnaît désormais plus : pour lui c'est un document JSON quelconque, peut-être la représentation d'une ressource. Le programme le rejette dans tous les cas :

```text
$ node fig05_02.ts
FALLA GET /servicios/99 (servicio que no existe)
      tipo application/json, se esperaba application/problem+json
FALLA GET /servicios/3 (servicio de otro equipo)
      tipo application/json, se esperaba application/problem+json
FALLA GET /revisiones/99 (revisión que no existe)
      tipo application/json, se esperaba application/problem+json
FALLA GET /servicioss (ruta que no existe)
      tipo application/json, se esperaba application/problem+json
FALLA PATCH /servicios/1 (método que la ruta no admite)
      tipo application/json, se esperaba application/problem+json
FALLA GET /servicios (sin credencial)
      tipo application/json, se esperaba application/problem+json
FALLA POST /servicios (cuerpo en texto)
      tipo application/json, se esperaba application/problem+json
FALLA POST /servicios (cuerpo de más de 16 KiB)
      tipo application/json, se esperaba application/problem+json
FALLA POST /servicios (datos imposibles)
      tipo application/json, se esperaba application/problem+json
FALLA POST /servicios (nombre repetido)
      tipo application/json, se esperaba application/problem+json
FALLA PUT /servicios/1 (cambio sin If-Match)
      tipo application/json, se esperaba application/problem+json
FALLA GET /v0/servicios (versión retirada)
      tipo application/json, se esperaba application/problem+json
FALLA GET /servicios/1/informe (error interno)
      tipo application/json, se esperaba application/problem+json

0 de 13 respuestas son Problem Details bien formados
```

Zéro sur treize, pour une seule ligne. C'est un défaut courant, parce que beaucoup de frameworks mettent `application/json` sur tout ce qu'ils sérialisent. La correction est celle de `fig05_01/` : le type est écrit par `fallar`, à un seul endroit, pour toutes les erreurs. Arrête les programmes de `rota2/` quand tu as terminé.

## Ce qui se fait de travers

**Décider avec `detail` ou avec `title`.** C'est ce que faisaient les deux scripts de la scène. Les phrases se corrigent, se raccourcissent et se traduisent, et chaque changement casse le client sans que ni le code ni le `type` aient changé. La RFC demande au client de ne pas interpréter `detail`, et lui donne le `type` pour décider.

**Mettre dans une phrase ce dont une machine a besoin.** Un id, une route, une quantité, un champ : si un client peut en avoir besoin, cela va dans une extension avec un nom propre. La phrase est pour les personnes.

**Un `type` par occurrence.** `…/servicio-inexistente/99`, ou un `type` avec la date. Un `type` est le nom d'une classe de problèmes ; s'il change à chaque occurrence, le client ne peut le comparer à rien. Ce qui change à chaque occurrence va dans `detail` et `instance`.

**Changer un `type` publié.** Même si le mot est mal orthographié, ou ne te plaît plus. Le changer, c'est changer l'API : tous les clients qui décidaient avec lui cessent de reconnaître le problème. Si c'est vraiment nécessaire, on le traite comme n'importe quel changement de version, avec préavis.

**Un `status` différent du code, ou sous forme de texte.** Différent, il contredit la ligne d'état, et presque tout le chemin croira la ligne. Sous forme de texte, `"404"`, un client qui suit la RFC l'ignore comme s'il n'était pas là. Dans le `revisor`, les deux choses sont impossibles parce que le `status` sort du catalogue.

**`application/json` dans les erreurs.** Le corps peut être parfait, et le client générique ne sait pas que c'est un problème. C'est la section « L'erreur que tu vas voir ».

**Utiliser le format pour déboguer.** Traces de pile, requêtes SQL, noms de classes, chemins de la machine dans le `detail` ou dans une extension. La RFC le dit dans la section 4 : les Problem Details ne sont pas un outil de débogage de l'implémentation, mais une façon de mieux expliquer l'interface HTTP. Pour déboguer, il y a la référence dans `instance` et le journal de celui qui exploite le service.

**Un type propre pour ce que le code dit déjà.** Un `type` « méthode non autorisée » ou « non autorisé » n'ajoute rien à un `405` ou à un `401` avec leurs en-têtes. Pour cela, il y a `about:blank`.

**Rassembler des problèmes de types différents dans un « lot ».** Une réponse a un code, et un `409` avec un `422` à l'intérieur n'a pas de code qui les représente. On répond au plus pertinent ; le client corrige et réessaie.

## Exercices

Les quatre s'autocorrigent : chacun se termine par une exécution qui te dit si tu as juste. Écris ta prédiction dans le [journal de bord](bitacora.md) **avant** d'exécuter quoi que ce soit. Pour les trois premiers, tu as besoin du laboratoire et du `revisor` de 5.14 tout juste démarrés.

### Exercice 1 — Quel problème est-ce ?

Sans rien exécuter, prédis le code, le `type` et le `title` de ces six réponses, et dis si l'une d'elles porte une extension :

```bash
curl -i http://127.0.0.1:18080/revisiones/99 -H 'Authorization: Bearer escritura-a'
curl -i -X DELETE http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200"}'
curl -i http://127.0.0.1:18080/v0/servicios
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{}'
curl -i http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer escritura-a'
```

Indice : les clés du catalogue de `problemas.ts` sont la carte. Ensuite, exécute-les et compare.

### Exercice 2 — Deux problèmes à la fois

Chacune de ces trois requêtes a deux problèmes de types différents. Prédis lequel des deux le `revisor` renvoie, et pourquoi celui-là :

```bash
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"ftp://pagos"}'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"","url":"http://169.254.169.254/"}'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a' -H 'Content-Type: text/plain' -d 'pagos'
```

La première répète un nom et apporte une adresse `ftp` ; la deuxième apporte un nom vide et une adresse interdite ; la troisième vient d'un lecteur et en texte. Exécute les trois.

### Exercice 3 — Ce que demande le client

Prédis ce que répond le `revisor` à ces trois requêtes. La première demande du HTML et dit préférer l'anglais ; la deuxième demande l'anglais pour une route qui n'existe pas ; la troisième utilise `-I`, qui envoie un `HEAD` :

```bash
curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a' -H 'Accept: text/html' -H 'Accept-Language: en'
curl -i http://127.0.0.1:18080/servicioss -H 'Authorization: Bearer escritura-a' -H 'Accept-Language: en'
curl -I http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
```

Répond-il `406` ? La langue de quelque chose change-t-elle ? Que renvoie le `HEAD` ? Exécute les trois et explique chaque réponse avec la section de la RFC qui la permet.

### Exercice 4 — La forme d'une extension

Copie `fig05_01/` sous le nom `ejercicio4/` et ajoute à `fallar`, dans `ejercicio4/problemas.ts`, une vérification de la règle de nommage de la section 5.9 : un nom d'extension commence par une lettre, n'utilise que des lettres, des chiffres et `_`, et comporte trois caractères ou plus. S'il ne la respecte pas, `fallar` lance une erreur, comme elle le fait déjà pour les noms réservés.

Pour savoir si tu as juste, fais trois choses. D'abord, démarre le laboratoire et le `revisor` depuis `ejercicio4/` et exécute `node fig05_02.ts` : il doit donner treize sur treize, parce que `existente` et `errors` respectent la règle. Ensuite, change dans `ejercicio4/servicios.ts` l'extension `existente: ` de l'enregistrement en `ex: `, redémarre le `revisor` et essaie d'enregistrer `pagos` à nouveau. Prédis quel code il renvoie et ce qui apparaît dans le terminal. Enfin, change `ex: ` en `status: `, redémarre et répète l'enregistrement : prédis ce qu'il renvoie et ce que dit le terminal.

## Solutions

### Solution 1

```text
$ curl -i http://127.0.0.1:18080/revisiones/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 177
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/revision-inexistente","title":"La revisión no existe","status":404,"detail":"no existe la revisión 99","instance":"/revisiones/99"}

$ curl -i -X DELETE http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 403 Forbidden
Content-Type: application/problem+json
Content-Language: es
Content-Length: 231
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/permiso-insuficiente","title":"La credencial no tiene permiso","status":403,"detail":"tu credencial solo puede leer; para escribir pide una con rol de escritor","instance":"/servicios/1"}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 428 Precondition Required
Content-Type: application/problem+json
Content-Language: es
Content-Length: 202
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/falta-condicion","title":"Falta la condición If-Match","status":428,"detail":"para cambiar un servicio manda If-Match con su ETag","instance":"/servicios/1"}

$ curl -i http://127.0.0.1:18080/v0/servicios
HTTP/1.1 410 Gone
Content-Type: application/problem+json
Content-Language: es
Content-Length: 231
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/version-retirada","title":"Esa versión de la API se retiró","status":410,"detail":"la versión 0 de la API se retiró el 31 de enero de 2026; usa /servicios","instance":"/v0/servicios"}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 333
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"2 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser un texto de 1 a 40 caracteres","pointer":"#/nombre"},{"detail":"debe ser una dirección http o https","pointer":"#/url"}]}

$ curl -i http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 504 Gateway Timeout
Content-Type: application/problem+json
Content-Language: es
Content-Length: 200
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-lento","title":"El servicio no respondió a tiempo","status":504,"detail":"el servicio 5 no respondió en 1000 ms","instance":"/servicios/5/salud"}
```

Les six sont des types propres au `revisor`, et chacune dit sa clé dans le `type`. La révision qui n'existe pas a son type, `revision-inexistente`, distinct de celui du service : le client cherche des choses différentes. Le lecteur qui essaie de supprimer reçoit `permiso-insuficiente`, sans extensions, et remarque ce que son `detail` ne dit **pas** : « tu credencial solo puede leer », sans répéter laquelle. Dans le `revisor` d'entraînement, le nom de l'identifiant est le même texte que le *jeton* qui voyage dans `Authorization`, et le répéter dans le corps laisserait le secret copié dans n'importe quel journal du client ou d'un intermédiaire : c'est ce que la section 5 de la RFC demande de vérifier dans chaque `detail`. La modification sans `If-Match` est `falta-condicion` (`428`), et le `revisor` n'a même pas lu le corps : après avoir vu qu'il se déclare JSON, la condition est interrogée avant de le lire. La version retirée ne demande pas d'identifiant et répond `version-retirada` (`410`). L'enregistrement vide est `datos-invalidos` avec l'extension `errors` et **deux** échecs, non trois : `limite_ms` n'est pas venu, et sa valeur par défaut est valide. Et le contrôle de santé du service 5 est `servicio-lento` (`504`), qui a mis une seconde à arriver parce que le `revisor` a attendu la limite du service avant de renoncer.

### Solution 2

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"ftp://pagos"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 260
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"1 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser una dirección http o https","pointer":"#/url"}]}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"","url":"http://169.254.169.254/"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 265
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"1 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser un texto de 1 a 40 caracteres","pointer":"#/nombre"}]}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a' -H 'Content-Type: text/plain' -d 'pagos'
HTTP/1.1 403 Forbidden
Content-Type: application/problem+json
Content-Language: es
Content-Length: 229
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/permiso-insuficiente","title":"La credencial no tiene permiso","status":403,"detail":"tu credencial solo puede leer; para escribir pide una con rol de escritor","instance":"/servicios"}
```

Aucune ne renvoie le `409` ni le `422` de destination que tu attendais peut-être. La première donne `datos-invalidos` avec un seul échec, celui de `url` : `validar` s'exécute avant la recherche du nom en double, et avec une adresse `ftp` l'enregistrement n'arrive même pas à interroger le nom. La deuxième donne aussi `datos-invalidos`, avec l'échec de `nombre` : `validar` s'exécute avant la vérification de la destination, et comme l'adresse `http://169.254.169.254/` est une adresse `http` valide, `validar` ne la signale pas ; c'est `destinoPermitido` qui la vérifierait, et elle n'arrive pas à s'exécuter. La troisième donne `403` et non `415` : la permission est la quatrième question du point d'entrée, et le format est l'une de celles du gestionnaire. Dans les trois cas, le plus pertinent est celui que le `revisor` rencontre en premier, et ce qu'il rencontre en premier est décidé par l'ordre dans lequel il interroge. C'est pourquoi cet ordre se conçoit et se documente.

### Solution 3

```text
$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a' -H 'Accept: text/html' -H 'Accept-Language: en'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 174
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"El servicio no existe","status":404,"detail":"no existe el servicio 99","instance":"/servicios/99"}

$ curl -i http://127.0.0.1:18080/servicioss -H 'Authorization: Bearer escritura-a' -H 'Accept-Language: en'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 111
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"about:blank","title":"Not Found","status":404,"detail":"no existe esa ruta","instance":"/servicioss"}

$ curl -I http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 174
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

Aucune n'est `406`, et rien ne change de langue. Le `revisor` ne négocie pas le contenu de ses erreurs : il ignore `Accept` et `Accept-Language`, et envoie `application/problem+json` en espagnol. La RFC 9110 le permet : si aucune représentation n'est acceptable selon un en-tête de négociation, le serveur peut répondre `406` ou traiter la réponse comme s'il n'y avait pas de négociation (section 12.4.1) ; et la RFC 9457 envoie son deuxième exemple en `application/problem+json` à un client qui avait seulement demandé `application/json` (section 3). Pour une erreur, c'est le mieux : le client reçoit l'explication au lieu d'une autre erreur. Le `title` d'`about:blank` reste en anglais parce que c'est toujours ainsi dans le `revisor`, non parce que le client l'a demandé ; la RFC permettrait de le traduire avec `Accept-Language`, et le `revisor` décide de ne pas le faire (section 5.5). Et le `HEAD` renvoie les mêmes en-têtes que le `GET`, avec `Content-Length: 174`, mais sans corps : Node ne l'envoie pas dans un `HEAD`, et la longueur dit combien il mesurerait.

### Solution 4

La vérification, dans `ejercicio4/problemas.ts` (fragment ; le fichier complet se trouve dans `ejercicio4/problemas.ts` du dépôt) :

```ts
  for (const nombre of Object.keys(extensiones)) {
    if (RESERVADOS.has(nombre)) throw new Error(`la extensión ${nombre} usa un nombre reservado`);
    // RFC 9457, sección 4: empieza con letra, solo letras, dígitos y «_», y tres caracteres o más.
    if (!/^[A-Za-z][A-Za-z0-9_]{2,}$/.test(nombre)) throw new Error(`la extensión ${nombre} no cumple la forma del RFC 9457`);
  }
```

L'expression dit : une lettre (`[A-Za-z]`), puis deux lettres, chiffres ou tirets bas ou plus (`[A-Za-z0-9_]{2,}`), et rien d'autre (`^` et `$`). Ce sont des lettres de l'alphabet anglais exprès : c'est ce que la RFC appelle `ALPHA`, et un `ñ` n'en est pas une. L'exécution :

```text
$ node fig05_02.ts
ok    GET /servicios/99 (servicio que no existe)
ok    GET /servicios/3 (servicio de otro equipo)
ok    GET /revisiones/99 (revisión que no existe)
ok    GET /servicioss (ruta que no existe)
ok    PATCH /servicios/1 (método que la ruta no admite)
ok    GET /servicios (sin credencial)
ok    POST /servicios (cuerpo en texto)
ok    POST /servicios (cuerpo de más de 16 KiB)
ok    POST /servicios (datos imposibles)
ok    POST /servicios (nombre repetido)
ok    PUT /servicios/1 (cambio sin If-Match)
ok    GET /v0/servicios (versión retirada)
ok    GET /servicios/1/informe (error interno)

13 de 13 respuestas son Problem Details bien formados

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json
Content-Language: es
Content-Length: 244
Date: Wed, 21 Oct 2026 13:18:37 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/error-interno","title":"Error interno del revisor","status":500,"detail":"ocurrió un error inesperado; si se repite, reporta la referencia","instance":"urn:uuid:c0160764-27de-42f7-866a-28ea3f622e08"}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json
Content-Language: es
Content-Length: 244
Date: Wed, 21 Oct 2026 13:18:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/error-interno","title":"Error interno del revisor","status":500,"detail":"ocurrió un error inesperado; si se repite, reporta la referencia","instance":"urn:uuid:6e53e149-c257-402b-8ea7-2e74df849fb6"}
```

Avec la règle, le `revisor` donne toujours treize sur treize, parce que ses deux extensions la respectent. Avec `ex`, l'enregistrement en double ne répond pas `409` mais `500` : le nom de l'extension est un défaut du programme, non du client, et `fallar` refuse d'envoyer un corps qui ne respecte pas le format. Le terminal le dit avec la même référence que celle qu'a reçue le client :

```text
POST /servicios
error c0160764-27de-42f7-866a-28ea3f622e08 en POST /servicios: Error: la extensión ex no cumple la forma del RFC 9457
    at fallar (file://<carpeta>/problemas.ts:54:59)
    at Object.darDeAlta [as manejador] (file://<carpeta>/servicios.ts:150:5)
    at async atender (file://<carpeta>/rutas.ts:107:3)
    at async atenderSinFiltrar (file://<carpeta>/servidor.ts:23:5)
```

Avec `status`, il se passe la même chose, mais à cause de l'autre règle : la forme du nom est correcte, et c'est l'un des cinq réservés. Sans cette vérification, le `...extensiones` écrirait par-dessus le `status` du catalogue (section 5.9). Le terminal, après le second redémarrage :

```text
POST /servicios
error 6e53e149-c257-402b-8ea7-2e74df849fb6 en POST /servicios: Error: la extensión status usa un nombre reservado
    at fallar (file://<carpeta>/problemas.ts:52:39)
    at Object.darDeAlta [as manejador] (file://<carpeta>/servicios.ts:150:5)
    at async atender (file://<carpeta>/rutas.ts:107:3)
    at async atenderSinFiltrar (file://<carpeta>/servidor.ts:23:5)
```

Que le défaut sorte comme un `500` et non comme une réponse mal formée, c'est toute l'idée : une erreur qu'on remarque au premier essai et non chez le client de quelqu'un d'autre. Rends à `existente` son nom quand tu as terminé.

## Comment savoir que tu as réussi

- [ ] Tu énonces de mémoire les cinq membres d'un Problem Details, pour qui est chacun et lesquels changent d'une occurrence à l'autre.
- [ ] `curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'` donne `404` avec `Content-Type: application/problem+json`, `Content-Language: es` et `"type":"https://revisor.example/problemas/servicio-inexistente"` ; `/servicios/3` donne le même `type` et le même `title`.
- [ ] `/servicioss` donne `"type":"about:blank","title":"Not Found"`, et `PATCH /servicios/1` donne `about:blank`, `Method Not Allowed` et `Allow: GET, HEAD, PUT, DELETE`.
- [ ] Un enregistrement avec trois champs erronés donne `422` avec `errors` et trois `pointer` (`#/nombre`, `#/url`, `#/limite_ms`) ; un enregistrement avec un nom en double donne `409` avec `"existente":"/servicios/2"`.
- [ ] `GET /servicios/1/informe` donne `500` avec `instance` `urn:uuid:…`, et tu retrouves cette même référence dans le terminal du `revisor`, à côté de la trace de pile.
- [ ] Tu expliques pourquoi un client décide avec `type` et non avec `title` ni avec `detail`, et pourquoi le `title` d'`about:blank` est en anglais.
- [ ] Une extension nommée `status` donne `500`, et le terminal dit `usa un nombre reservado` avec la même référence que celle qu'a reçue le client.
- [ ] `node fig05_02.ts` donne `13 de 13`, et contre `defectos/json-a-secas/` il donne `0 de 13`.
- [ ] À la fin, aucun programme n'écoute plus : `curl -i http://127.0.0.1:18080/` donne l'erreur 7.

## Résumé

Réponds sans regarder la leçon :

1. Quel type de contenu porte un Problem Details en JSON, et qu'y gagne le client à ce que ce ne soit pas `application/json` ?
2. Quels sont les cinq membres ? Quel est l'identifiant principal du problème, selon la RFC, et avec quel verbe le dit-elle ?
3. Que signifie `about:blank` ? Quel `title` porte-t-il et pourquoi ?
4. Qu'est-ce qui se traduit et qu'est-ce qui ne se traduit pas dans un Problem Details ?
5. Quelle règle lie `status` à la ligne d'état, et pourquoi, dans le `revisor`, ne peuvent-ils pas différer ?
6. Qu'est-ce qu'`instance` dans un `404` du `revisor`, et qu'est-ce dans un `500` ? À quoi sert la seconde ?
7. Que doit faire un client avec une extension qu'il ne connaît pas ? Quelles règles de nommage a une extension ?
8. Comment répond-on à plusieurs problèmes du même type ? Et à plusieurs problèmes de types différents ?
9. Quelles trois choses ont changé entre la RFC 7807 et la RFC 9457 ?

## Sources

Toutes ont été consultées le 21 octobre 2026.

1. [RFC 9457, *Problem Details for HTTP APIs*](https://www.rfc-editor.org/rfc/rfc9457.html) (juillet 2023, norme proposée de l'IETF), section 3 : l'objet, `application/problem+json`, l'exemple de `errors` avec `pointer` et la règle de plusieurs problèmes.
2. [RFC 9457, section 3.1](https://www.rfc-editor.org/rfc/rfc9457.html#section-3.1) : les cinq membres, la règle d'ignorer un membre dont le type est erroné, `type` comme identifiant principal (3.1.1), `status` (3.1.2), `title` (3.1.3), `detail` (3.1.4) et `instance` (3.1.5).
3. [RFC 9457, section 3.2](https://www.rfc-editor.org/rfc/rfc9457.html#section-3.2) : les extensions et l'obligation d'ignorer celles que l'on ne connaît pas.
4. [RFC 9457, section 4](https://www.rfc-editor.org/rfc/rfc9457.html#section-4) : quand définir un type, quoi documenter, `Retry-After` et les règles de nommage des extensions.
5. [RFC 9457, sections 4.2 et 4.2.1](https://www.rfc-editor.org/rfc/rfc9457.html#section-4.2) : le registre des types et `about:blank`, avec le `title` égal à la phrase du code.
6. [RFC 9457, section 5 et annexe D](https://www.rfc-editor.org/rfc/rfc9457.html#section-5) : les considérations de sécurité et les changements par rapport à la RFC 7807.
7. [IANA, *HTTP Problem Types*](https://www.iana.org/assignments/http-problem-types/http-problem-types.xhtml) : le registre officiel, avec six entrées, mis à jour le 26 juin 2026.
8. [IANA, registre du type de contenu `application/problem+json`](https://www.iana.org/assignments/media-types/application/problem+json) : sans paramètres, avec renvoi à la RFC 9457.
9. [RFC 7807, *Problem Details for HTTP APIs*](https://www.rfc-editor.org/rfc/rfc7807.html) (mars 2016), la version précédente, aujourd'hui obsolète.
10. [*Indicating Details of Problems to Machines in HTTP*, draft-nottingham-http-problem-00](https://datatracker.ietf.org/doc/draft-nottingham-http-problem/00/) (4 juillet 2012), le brouillon original et son avertissement.
11. [RFC 9110, *HTTP Semantics*, sections 8.5, 12.1, 12.4.1, 12.5.1, 13.2.1 et 15.5.14](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.5) : `Content-Language` et les langues d'une représentation, la liberté du serveur de ne pas négocier, pourquoi le `415` passe avant la précondition, et le `413`.
12. [RFC 6901, *JavaScript Object Notation (JSON) Pointer*](https://www.rfc-editor.org/rfc/rfc6901.html), sections 3 et 6 : la syntaxe de `pointer` et sa forme de fragment d'URI (`#/nombre`).
13. [RFC 9562, *Universally Unique IDentifiers (UUIDs)*](https://www.rfc-editor.org/rfc/rfc9562.html) : l'identifiant de la référence `urn:uuid:` des erreurs internes.
14. [RFC 6761, *Special-Use Domain Names*](https://www.rfc-editor.org/rfc/rfc6761.html), section 6.5 : `.example`, réservé à la documentation.
15. [IANA, *HTTP Status Codes*](https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml) : les phrases officielles des codes, qui sont le `title` d'`about:blank`.

### Termes de cette leçon

| | |
|---|---|
| **Problem Details** | l'objet JSON de la RFC 9457 qui explique une erreur d'une API HTTP |
| **type de problème** | une classe de problèmes avec un nom propre : le `type`, son `title`, son code et ses extensions |
| **occurrence** | une fois concrète où un problème s'est produit ; elle est décrite par `detail` et `instance` |
| **`about:blank`** | le type qui n'ajoute rien au code d'état ; son `title` est la phrase du code |
| **extension** | un membre propre à un type de problème, en plus des cinq standard |
| **JSON Pointer** | la façon standard de désigner un endroit à l'intérieur d'un JSON, comme `#/nombre` |
| **catalogue** | la table de tous les types de problème d'une API |
| **gestionnaire central** | l'unique fonction par laquelle passent toutes les réponses d'erreur |

---

**Précédent :** [Leçon 4 — Capacité et défaillances du serveur : 429, 500, 502, 503 et 504](04-capacidad-y-fallas-del-servidor.md) · **Suivant :** [Leçon 6 — Nouvelles tentatives et idempotence](06-reintentos-idempotencia.md)

# Leçon 6 — Nouvelles tentatives et idempotence

Il est 23 h 50, le dernier jour du mois, et l'équipe des opérations enregistre, avec un script, les quatorze nouveaux services que le `revisor` doit surveiller dès minuit. Le script ne parle pas directement au `revisor` : il passe par la passerelle de l'entreprise, comme tout le reste. À 23 h 52, la passerelle traverse une mauvaise minute. Le script envoie l'enregistrement d'`agenda`, le `revisor` le reçoit, le sauvegarde et répond `201`, et cette réponse se perd sur le chemin du retour. Au script arrive un `502 Bad Gateway`. Celui qui l'a écrit a été prudent : face à un `502`, il réessaie. La deuxième tentative passe bel et bien, et le `revisor` répond `409 Conflict` : « un service nommé agenda existe déjà ». Le script traite le `409` comme une erreur, s'arrête et laisse treize services sans enregistrement. À 00 h 00, les vérifications démarrent et la moitié du tableau est vide. Personne ne sait si `agenda` a été créé par le script ou par quelqu'un d'autre, parce que le `409` ne le dit pas. Et la personne d'astreinte, pour ne pas prendre de risque, supprime `agenda` et le recrée manuellement, juste au moment où un collègue relance le script en entier.

Aucune de ces décisions n'était sotte. Ce qui manquait, c'était un moyen de **répéter une requête sans craindre qu'elle fasse deux fois la même chose**, et une règle claire sur **le moment** où la répéter. C'est ce que construit cette leçon.

**Durée :** 2 × 45 min (la coupure se situe entre les sections 6.4 et 6.5)

**Ce que tu construis :** un `POST /servicios` qu'on peut répéter sans créer de doublon tant que le serveur se souvient de la clé (la section 6.7 dit jusqu'où va cette garantie), avec l'en-tête `Idempotency-Key` ; une passerelle qui perd des réponses exprès, pour voir le `502` qui ne dit pas si l'écriture a eu lieu ; un client qui réessaie l'enregistrement avec la même clé ; les vérifications du `revisor` avec nouvelles tentatives, backoff exponentiel et *jitter* ; et un programme qui vérifie l'idempotence de l'enregistrement

**Ce que tu apprends :** ce que sont les méthodes sûres et idempotentes selon la RFC 9110, et ce que l'idempotence **ne** promet **pas** ; les deux questions qui décident d'une nouvelle tentative ; le backoff exponentiel avec *jitter* complet et pourquoi le hasard protège le serveur ; quand obéir à `Retry-After` et quand ne pas attendre ; `Idempotency-Key` et pourquoi ce n'est **pas encore un standard** ; combien de temps dure une clé, ce qui se passe si le corps change et ce qu'elle ne couvre pas ; et que faire d'un `502` qui ne dit pas si l'écriture a eu lieu

**D'où tu viens.** De la [Leçon 5](05-problem-details.md), avec un `revisor` dont les erreurs sont déjà des Problem Details : un `type` stable, un `title` qui ne change pas, un `detail` pour la personne qui lit. Dans la [Leçon 4](04-capacidad-y-fallas-del-servidor.md), tu as appris à lire `Retry-After` sous ses deux formes, et tu as vu qu'une vérification de `pagos` se termine avec `"detalle":"503 (reintentar en 120 s)"`, mais le `revisor` ne faisait rien de ce nombre. Dans la [Leçon 1](01-exitos-redirecciones.md), tu as vu qu'un second `DELETE` ne change rien, et que cela avait un nom : l'idempotence. Cette leçon réunit les trois. Jusqu'ici, répéter un enregistrement crée un autre service ou se heurte au `409` du nom en double sans que tu saches si le service était le tien, et les vérifications ne réessaient jamais.

**Ce que cette leçon ne fait pas.** Elle n'écrit pas la table qui décide quoi faire de chaque code côté client ; c'est la [Leçon 7](07-quien-lee-el-error.md), qui décide aussi quoi faire du `409` d'une clé en cours d'utilisation. Elle ne documente pas l'en-tête dans OpenAPI ; c'est la [Leçon 8](08-contrato-verificable.md). Elle ne stocke pas les clés dans une base de données : le `revisor` les garde en mémoire, et la section 6.7 dit ce qui change dans une API réelle. Et elle n'implémente ni budget de nouvelles tentatives partagé ni coupe-circuit (circuit breaker) : elle les mentionne en 6.3.3 parce qu'ils existent et qu'il vaut mieux les connaître, mais le `revisor` se contente de limiter le nombre de fois où il réessaie chaque requête.

**À propos des exécutions.** Linux Mint 22 est le système de référence du cours. Les sorties de cette leçon ont été obtenues le 21 octobre 2026 sous macOS avec Node 24.14.1 et curl 8.7.1, en ajoutant `-sS` à chaque `curl` parce que la sortie allait dans un fichier (`-s` désactive la barre de progression, `-S` laisse voir les erreurs, et aucune des deux ne change la réponse). Toutes les séries ont été exécutées sur les ports 18080, 18081 et 18082, qui sont ceux que tu vas saisir toi-même, sur la version finale des programmes, et chaque fichier `.salida.txt` est la capture telle qu'elle est sortie, sauf que dans les lignes de commande on a retiré le `-sS` (`fig06_02.salida.txt` n'utilise pas de serveurs : c'est un échantillonnage aléatoire). Les versions cassées de « L'erreur que tu vas voir » et la solution de l'exercice 3 ont été exécutées depuis des copies dans d'autres dossiers ; dans les sorties, le vérificateur apparaît sous la forme `node fig06_03.ts`, qui est la façon dont tu vas le lancer. Dans ton exécution, vont changer la date de `Date`, les huit chiffres finaux de chaque `ETag` (le `revisor` les tire au sort au démarrage), les millisecondes mesurées, les attentes tirées au sort par le *jitter* (celles de `fig06_02.ts` sont différentes à chaque fois, exprès), les clés qu'invente `alta-segura.ts` et les noms qu'invente `fig06_03.ts`. Le `revisor` garde tout en mémoire, services et clés : pour obtenir la même chose que la leçon, redémarre le laboratoire, le `revisor` et la passerelle avant chaque série de requêtes. Elle n'a pas été exécutée sur une installation de bureau de Mint, et rien de ce qui est utilisé ne dépend de macOS. Les programmes se trouvent dans [`programas/06-reintentos-idempotencia/`](../programas/06-reintentos-idempotencia), dans le dépôt du cours : le `revisor` dans `fig06_01/`, le backoff vu de près dans `fig06_02.ts`, le vérificateur d'idempotence dans `fig06_03.ts`, le serveur simulé dans `fig06_04.ts`, les versions cassées dans `defectos/`, la solution de l'exercice 3 dans `ejercicios/ej3/` et chaque exécution dans son fichier `.salida.txt` (celle des tentatives épuisées, dans `agotados.salida.txt`). Tous passent `tsc` en mode strict (section 6.10).

## À la fin, tu seras capable de

- Dire, pour chaque méthode HTTP, si elle est sûre, si elle est idempotente ou ni l'une ni l'autre, en citant la RFC 9110, et le démontrer en répétant une requête contre le `revisor` et en comparant l'état avant et après.
- Expliquer pourquoi un `DELETE` répété qui répond `204` puis `410` reste idempotent, et pourquoi un `PUT` avec `If-Match` répété répond `412` alors que son changement a bien eu lieu.
- Décider si une défaillance mérite une nouvelle tentative grâce à deux questions, peut-elle s'améliorer d'elle-même ? et est-il sûr de la répéter ?, et justifier pourquoi le `revisor` réessaie un `502` et pas un `404`.
- Calculer le plafond de l'attente de chaque tentative avec un backoff exponentiel et un *jitter* complet, et montrer par une exécution que le hasard répartit les nouvelles tentatives de mille clients.
- Faire en sorte qu'un `POST` répété avec la même `Idempotency-Key` renvoie la même réponse sans créer d'autre ressource, et provoquer les deux refus que propose le brouillon : `422` si la clé arrive avec un autre corps et `409` si la requête d'origine est toujours en cours.
- Expliquer les limites d'une clé d'idempotence : combien de temps elle dure, ce qui compte comme « le même corps » et ce qu'elle ne couvre pas, chacun avec une exécution qui le démontre.
- Expliquer ce que fait un client quand il a épuisé ses tentatives ou que personne ne lui répond (il sort avec un message et avec le code `1`, sans attendre plus que nécessaire), et provoquer ces cas avec le `revisor` ou la passerelle arrêtés.
- Prédire ce que fait `alta-segura.ts` face à un `4xx`, face à un `Retry-After` court et à un long, face à un serveur qui ne répond pas et face aux deux `409`, et le vérifier avec le serveur simulé.
- Exécuter un programme qui vérifie l'idempotence de l'enregistrement et lire son échec contre une version volontairement cassée.

## Le pourquoi avant le comment

Une nouvelle tentative est la réponse la plus naturelle à une défaillance, et aussi la plus dangereuse. Naturelle, parce que beaucoup de défaillances sont passagères : un service qui redémarrait, une passerelle qui traverse une mauvaise minute, une connexion qui s'est coupée. Dangereuse, pour deux raisons que cette leçon sépare avec soin.

La première est que **tu ne sais pas toujours si ce que tu as demandé a eu lieu**. Quand une requête échoue avant d'arriver au serveur, la répéter est inoffensif : le serveur ne l'a jamais vue. Quand elle échoue *après* que le serveur l'a traitée, mais avant que la réponse ne t'arrive, la répéter revient à demander la même chose une seconde fois. De ton côté, les deux cas se ressemblent : un `502`, un délai dépassé, une connexion coupée. La scène d'ouverture, c'est exactement cela : le `revisor` a créé `agenda`, et le script ne l'a jamais su. Si l'opération est une lecture, peu importe. Si l'opération est de créer, de débiter, d'envoyer un courriel ou de déplacer du stock, la répéter peut en dupliquer l'effet.

La seconde raison est que **une nouvelle tentative coûte au serveur**. Si un service échoue parce qu'il est saturé et que mille clients réessaient au même instant, ce qu'il reçoit n'est pas un soulagement mais une autre vague de mille requêtes, puis une autre. Une nouvelle tentative mal faite transforme un faux pas de deux secondes en une panne de vingt minutes.

HTTP règle déjà une partie du premier problème. La RFC 9110 classe les méthodes : certaines sont **idempotentes**, et les répéter laisse le serveur dans le même état que les faire une seule fois. Avec elles, la nouvelle tentative est sûre par définition. Mais la méthode qui sert à créer des choses, `POST`, ne l'est pas, et c'est justement celle dont l'échec fait le plus mal. Pour elle, l'industrie a inventé un en-tête, `Idempotency-Key`, qu'un brouillon de l'IETF a tenté de standardiser sans jamais être publié comme RFC. Le second problème, celui du serveur saturé, se règle côté client : attendre de plus en plus entre les tentatives, tirer l'attente au sort et obéir au serveur quand il dit combien de temps attendre.

La leçon comporte quatre parties :

1. **Ce qu'on peut répéter** (6.1 à 6.3) : le `revisor` de cette leçon, les méthodes sûres et idempotentes, et les deux questions qui décident d'une nouvelle tentative.
2. **Comment on répète** (6.4) : backoff exponentiel, *jitter* et `Retry-After`, avec les vérifications du `revisor`.
3. **Ce qu'on ne peut pas répéter… jusqu'à ce qu'on le puisse** (6.5 à 6.7) : le `502` qui ne dit pas si l'écriture a eu lieu, `Idempotency-Key` et ses limites.
4. **Le `revisor` complet** (6.8 à 6.10) : les fichiers, l'exécution et le programme qui le vérifie.

## Les concepts

### 6.1 Le `revisor` de cette leçon

#### 6.1.1 Ce qui change

Le `revisor` de la Leçon 5 gagne trois fichiers et en modifie quatre :

- **`idempotencia.ts`** (nouveau) garde, par identifiant et par clé, l'empreinte de la requête et la réponse qu'elle a reçue. C'est la section 6.6.
- **`pasarela.ts`** (nouveau) est un programme à part qui écoute sur le port 18082 et transmet tout au `revisor`. Avec l'en-tête `X-Simular: perder-primera`, la première fois qu'elle voit une requête, elle laisse le `revisor` la traiter et jette la réponse : elle répond `502` au client. Si le `revisor` ne répond pas (parce qu'il est arrêté), elle répond aussi `502` et continue d'écouter. C'est la section 6.5.
- **`alta-segura.ts`** (nouveau) est un client qui enregistre un service à travers la passerelle et réessaie avec la même clé, jusqu'à quatre fois, puis s'arrête dès que les tentatives sont épuisées. Il obéit à `Retry-After`, interrompt chaque tentative par un délai maximal et ne sort avec 0 que si l'enregistrement a bien eu lieu. Il relève aussi de la section 6.5.
- **`servicios.ts`** lit `Idempotency-Key` à l'enregistrement, et les vérifications utilisent `revisarConReintentos` à la place de `revisar`.
- **`cliente.ts`** sépare la classification (`clasificar`) de la requête, et gagne le backoff avec *jitter* et `revisarConReintentos`. C'est la section 6.4.
- **`problemas.ts`** ajoute deux types au catalogue : `llave-en-curso` (`409`) et `llave-reutilizada` (`422`).
- **`respuestas.ts`** modifie la lecture du corps : quand il dépasse le plafond de 16 KiB, le `revisor` finit de lire ce que le client envoie encore avant de répondre `413`, pour que la réponse ne se perde pas. C'est la section 6.8.1.

Aucune route, aucun code du point d'entrée et aucun en-tête des leçons précédentes ne change. Le nouvel en-tête est optionnel : un enregistrement sans lui se comporte exactement comme dans la Leçon 5.

#### 6.1.2 Démarrer les trois

Le `revisor` vit dans `~/curso-http/fig06_01/` ; la section 6.8 apporte tous ses fichiers. Ouvre trois terminaux dans ce dossier :

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

```text
$ node pasarela.ts
pasarela en http://127.0.0.1:18082 → http://127.0.0.1:18080
```

Jusqu'à la section 6.5, tu n'utilises pas la passerelle, mais il vaut mieux l'avoir démarrée dès maintenant. Et un avertissement qui vaut pour toute la leçon : le `revisor` garde services, vérifications et clés en mémoire. Chaque série de requêtes de cette leçon commence avec les trois programmes fraîchement démarrés ; si la tienne en suit une autre, arrête-les avec `Ctrl+C` et redémarre-les, sinon les identifiants et les réponses ne coïncideront pas.

### 6.2 Sûr et idempotent : ce que dit la RFC 9110

#### 6.2.1 Les deux propriétés

La RFC 9110 définit deux propriétés des méthodes, et il convient de les lire avec soin parce qu'on les confond.

Une méthode est **sûre** si sa sémantique est essentiellement en lecture seule : celui qui l'utilise ne demande ni n'attend aucun changement d'état sur le serveur ([section 9.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.1)). Les méthodes sûres de la RFC sont `GET`, `HEAD`, `OPTIONS` et `TRACE`. « Sûr » ne veut pas dire que le serveur ne fait rien : la RFC elle-même donne l'exemple du journal d'accès, qui grossit à chaque `GET` et pourrait même remplir le disque. Cela veut dire que le client n'a pas demandé cet effet et n'en est pas responsable.

Une méthode est **idempotente** si l'effet recherché sur le serveur par plusieurs requêtes identiques est le même que celui d'une seule ([section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)). Les méthodes idempotentes de la RFC sont `PUT`, `DELETE` et toutes les méthodes sûres. Le mot vient des mathématiques : appliquer une opération deux fois donne la même chose que l'appliquer une fois.

Et la section 9.2.2 dit à quoi sert la distinction, avec une clarté qu'il vaut la peine de citer : les méthodes idempotentes se distinguent parce que **la requête peut être répétée automatiquement si la communication échoue avant que le client ne lise la réponse**. Si la connexion d'un `PUT` s'est fermée avant de recevoir quoi que ce soit, le client peut en ouvrir une autre et le répéter : il sait que le répéter aura le même effet recherché, même si la requête d'origine avait bien fonctionné, « though the response might differ », même si la réponse peut être différente.

| Méthode | Sûre | Idempotente | Source |
|---|---|---|---|
| `GET`, `HEAD`, `OPTIONS`, `TRACE` | oui | oui | RFC 9110, 9.2.1 et 9.2.2 |
| `PUT`, `DELETE` | non | oui | RFC 9110, 9.2.2 |
| `POST` | non | non | RFC 9110, 9.3.3 |
| `PATCH` | non | non | RFC 5789, section 2 |

`POST` n'est pas idempotent parce que sa sémantique est « traite ceci selon tes propres règles » ([section 9.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.3)), et l'une de ses fonctions typiques est de créer une ressource que le serveur n'a pas encore identifiée. Deux `POST` identiques peuvent créer deux ressources. `PATCH`, selon la RFC 5789, n'est ni sûr ni idempotent : un correctif peut dire « ajoute un », et ajouter un deux fois n'est pas la même chose que l'ajouter une fois.

La conséquence pratique tient en une ligne de la même RFC : **un client ne devrait pas réessayer automatiquement une requête dont la méthode n'est pas idempotente**, à moins d'avoir un moyen de savoir que cette requête en particulier est bien idempotente, ou un moyen de détecter que l'originale n'a jamais été appliquée. Ces deux issues sont exactement ce que tu vas construire : la première est `Idempotency-Key` ; la seconde, réconcilier (relire l'état et voir ce qui s'est passé). Et une ligne plus bas, une autre règle qui compte pour qui exploite des passerelles : **un proxy ne doit pas réessayer automatiquement des requêtes non idempotentes**. Une passerelle qui réessaie un `POST` de son propre chef peut dupliquer ce que son client n'a jamais demandé de dupliquer.

#### 6.2.2 Le voir dans le `revisor`

Avec les trois programmes fraîchement démarrés, répète chaque opération deux fois et regarde ce qui reste. Commence par un `PUT` avec son étiquette, comme l'a enseigné la Leçon 3 :

```text
$ ETAG=$(curl -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ETAG=$ETAG"
ETAG="1-1-a9fec589"

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-2-a9fec589"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 22:25:56 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 412 Precondition Failed
Content-Type: application/problem+json
Content-Language: es
Content-Length: 269
Date: Wed, 21 Oct 2026 22:25:56 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/etiqueta-vencida","title":"Tu etiqueta ya no es la vigente","status":412,"detail":"tu etiqueta ya no es la vigente: el servicio cambió o el revisor se reinició; vuelve a leerlo antes de cambiarlo","instance":"/servicios/1"}

$ curl http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}
```

Le premier `PUT` a ramené la limite à 1500 et a répondu `200` avec une nouvelle étiquette. Le second, identique, a répondu `412`. Et pourtant l'état final est celui que tu avais demandé : `"limite_ms":1500`. L'idempotence a été respectée, puisque l'effet de deux `PUT` est le même que celui d'un seul ; ce qui a changé, c'est la réponse, ce que la RFC signale justement. Le `412` ne dit pas « ton changement n'a pas eu lieu » ; il dit « ton étiquette n'est plus la courante ». Celui qui réessaie un `PUT` conditionnel et reçoit un `412` doit relire avant de conclure qu'il a perdu : il se peut que la version courante soit, précisément, la sienne.

Maintenant un `DELETE` deux fois :

```text
$ curl -i -X DELETE http://127.0.0.1:18080/servicios/4 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 22:25:56 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i -X DELETE http://127.0.0.1:18080/servicios/4 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 410 Gone
Content-Type: application/problem+json
Content-Language: es
Content-Length: 188
Date: Wed, 21 Oct 2026 22:25:56 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-retirado","title":"El servicio se retiró","status":410,"detail":"el servicio 4 se retiró y no va a volver","instance":"/servicios/4"}
```

`204` puis `410`. Des réponses différentes, un effet identique : après un ou deux `DELETE`, le service 4 est retiré. C'est le cas que la Leçon 1 avait annoncé. Un client qui réessaie un `DELETE` et reçoit `410` (ou `404`) ne devrait pas y voir une défaillance : ce qu'il voulait est déjà vrai.

Maintenant un `POST` d'enregistrement deux fois, sans rien d'autre :

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-a9fec589"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 22:25:57 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: application/problem+json
Content-Language: es
Content-Length: 220
Date: Wed, 21 Oct 2026 22:25:57 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/nombre-repetido","title":"Ya existe un servicio con ese nombre","status":409,"detail":"ya existe un servicio llamado avisos","instance":"/servicios","existente":"/servicios/7"}
```

Le premier a créé `avisos` avec l'id 7. Le second n'en a pas créé un autre, mais pas parce que `POST` serait idempotent : il a été arrêté par une règle métier, à savoir que le nom soit unique au sein de l'équipe. Ce filet t'a sauvé d'un doublon, et en échange t'a laissé avec le doute de la scène : le `409` dit que `/servicios/7` existe, il ne dit pas qui l'a créé. Si ta première tentative s'était perdue en chemin, tu ne saurais pas si `/servicios/7` est le tien ou celui d'un collègue qui a choisi le même nom.

Et un `POST` qui n'a aucun filet :

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios/1/revisiones -H 'Authorization: Bearer escritura-a'
HTTP/1.1 202 Accepted
Location: /revisiones/1
Content-Type: application/json
Content-Length: 60
Date: Wed, 21 Oct 2026 22:25:58 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"servicio":1,"estado":"pendiente","resultado":null}

$ curl -i -X POST http://127.0.0.1:18080/servicios/1/revisiones -H 'Authorization: Bearer escritura-a'
HTTP/1.1 202 Accepted
Location: /revisiones/2
Content-Type: application/json
Content-Length: 60
Date: Wed, 21 Oct 2026 22:25:58 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":2,"servicio":1,"estado":"pendiente","resultado":null}
```

Deux requêtes, deux vérifications : `/revisiones/1` et `/revisiones/2`. Demander une vérification n'est pas idempotent, et rien ne le retient. Ici le coût est faible (une requête de plus vers le service), mais observe le schéma : c'est la forme de tout `POST` qui crée quelque chose sans une donnée qui le rende unique. Un bon de commande, un paiement, un message.

#### 6.2.3 Ce que l'idempotence ne promet pas

Trois choses se confondent avec l'idempotence et n'en sont pas.

**Elle ne promet pas la même réponse.** La RFC le dit en toutes lettres, et tu viens de le voir : `204` et `410`, `200` et `412`. Un client qui compare la deuxième réponse à la première pour décider si quelque chose s'est mal passé mesure ce qu'il ne faut pas mesurer.

**Elle ne promet pas que rien ne change.** Un `PUT` avec `If-Match: *` répété laisse le même contenu, mais le `revisor` incrémente la version à chaque écriture, si bien que l'`ETag` passe de `"1-2-…"` à `"1-3-…"` (tu le verras dans l'exercice 1). La RFC laisse la place à cela : l'idempotence concerne l'effet que l'utilisateur a demandé, et le serveur est libre de tenir un historique, des journaux ou des versions à part.

**Ce n'est pas une propriété du réseau, mais de la méthode et du serveur.** Que la RFC dise que `PUT` est idempotent est une promesse que le serveur doit tenir. Si ton serveur implémente un `PUT` qui additionne, ou un `DELETE` qui supprime « le dernier », tu as rompu la promesse, et tous les clients, proxys et bibliothèques qui s'y fient vont dupliquer des effets sans le savoir. La RFC le dit pour les méthodes sûres, et cela vaut tout autant ici : si une URI fait quelque chose de non sûr avec une méthode sûre, la responsabilité revient à qui l'a conçue.

### 6.3 Quand réessayer et quand ne pas le faire

#### 6.3.1 Les deux questions

Chaque fois qu'une requête échoue, le `revisor` (et tout client que tu voudras écrire) se pose deux questions, dans cet ordre :

1. **Peut-elle s'améliorer d'elle-même ?** Un service saturé, une passerelle qui redémarre, un délai dépassé : attendre peut tout arranger. Un identifiant invalide, un service qui n'existe pas, un corps mal formé : non. Répéter ce qui ne peut pas s'améliorer tout seul, c'est gaspiller la patience du serveur et la tienne.
2. **Est-il sûr de la répéter ?** Si la méthode est idempotente, oui. Si elle ne l'est pas, seulement avec une clé d'idempotence ou si tu sais que l'originale n'est jamais arrivée.

Ce n'est que si les deux réponses sont « oui » qu'on réessaie. C'est un critère de conception, pas une norme : la RFC te dit quand il est *sûr* de répéter, et chaque API décide quand cela *vaut la peine*.

#### 6.3.2 Ce que le `revisor` réessaie

Les vérifications du `revisor` sont des `GET` vers les services qu'il surveille : sûrs et idempotents, si bien que la seconde question reçoit toujours « oui ». La première trouve sa réponse dans la fonction `vale` de `cliente.ts` :

| Issue de la requête | Peut-elle s'améliorer d'elle-même ? | Réessaie-t-il ? |
|---|---|---|
| pas de connexion, délai dépassé, réponse qui n'est pas du HTTP | elle le peut : ce qui est derrière est peut-être en train de démarrer | oui |
| `429 Too Many Requests` | oui : la limite se réinitialise avec le temps | oui, si `Retry-After` ne demande pas plus de 5 s |
| `502`, `503`, `504` | oui : la défaillance vient de quelque chose qui est derrière ou elle est temporaire | oui (si la réponse porte `Retry-After`, avec la même condition) |
| `500` | presque jamais : c'est un défaut du serveur | non |
| tout autre `4xx` | non : ce qu'il faut changer, c'est la requête | non |
| destination interdite (SSRF) | non : la règle ne va pas changer | non |

Le `500` mérite une ligne à part, parce que beaucoup de clients le réessaient. La RFC 9110 dit qu'un `500` est une condition inattendue qui a empêché le serveur de s'exécuter ; la Leçon 4 l'a traité comme un défaut du serveur, et répéter une requête contre un défaut reproduit presque toujours le défaut. Le `revisor` décide de ne pas le réessayer. D'autres API décident autrement, et c'est une décision qu'on écrit, pas une qu'on hérite d'une bibliothèque.

N'importe laquelle de ces réponses peut porter `Retry-After` (on le voit normalement sur un `429` ou un `503`) : le serveur dit combien de temps attendre, et le `revisor` lui obéit si c'est raisonnable. Tu le verras en 6.4.3.

#### 6.3.3 Combien de fois, et à quelle couche

La RFC 9110 contient une autre phrase, à la fin de la section 9.2.2, qu'il vaut la peine de connaître : **un client ne devrait pas réessayer automatiquement une nouvelle tentative automatique qui a échoué**. Elle est écrite pour le cas de la connexion coupée (l'agent utilisateur qui rouvre la connexion et répète une fois), et son esprit est clair : les nouvelles tentatives doivent avoir une fin. Le `revisor` fait jusqu'à trois tentatives par requête et `alta-segura.ts` jusqu'à quatre, si bien qu'ils vont au-delà de cette lettre, et c'est une décision assumée : ce sont des clients d'application qui connaissent l'opération, attendent de plus en plus longtemps et s'arrêtent à un plafond fixe. Si tu écris un client générique, qui ne sait rien de l'opération, la recommandation de la RFC est la prudente : une nouvelle tentative et c'est tout.

Le nombre de tentatives compte plus qu'il n'y paraît, à cause de l'**amplification**. Le guide d'Amazon sur les délais d'attente et les nouvelles tentatives l'explique avec un exemple : cinq couches de services, chacune réessayant trois fois de son côté, multiplient par 243 la charge sur la base de données du fond, juste au moment où elle est la plus faible. Le livre SRE de Google raconte le même phénomène avec trois couches : une seule action d'une personne finit en 64 tentatives contre la base de données. Les deux sources aboutissent à la même recommandation : **réessayer à un seul endroit de la chaîne**, limiter les nouvelles tentatives par requête et avoir un budget de nouvelles tentatives par processus qui cesse de réessayer quand il est épuisé (le livre SRE donne l'exemple de 60 par minute ; le guide d'Amazon propose un seau de jetons, le *token bucket*).

Dans le `revisor`, celui qui réessaie les vérifications, c'est le `revisor`, et personne d'autre. La passerelle de cette leçon ne réessaie rien : si elle le faisait avec un `POST`, elle enfreindrait la règle de la RFC pour les proxys.

### 6.4 Backoff exponentiel avec *jitter*

#### 6.4.1 Pourquoi attendre de plus en plus

Si une requête a échoué parce que le serveur est saturé, réessayer aussitôt aggrave ce que tu voulais arranger. L'idée du **backoff exponentiel** (*exponential backoff*) est d'attendre de plus en plus : un peu après le premier échec, le double après le deuxième, encore le double après le troisième, jusqu'à un plafond. Si la défaillance durait une seconde, la première nouvelle tentative l'évite. Si elle durait une minute, les nouvelles tentatives s'espacent et laissent au serveur de la marge pour récupérer.

Le `revisor` utilise une base de 250 ms et un plafond de 2 000 ms. Le plafond de la tentative `n` est `250 × 2^n`, sans dépasser 2 000 : 500 ms avant la deuxième tentative, 1 000 avant la troisième, et ensuite on butterait déjà sur le plafond.

#### 6.4.2 Pourquoi au hasard

Le backoff seul ne suffit pas. Si mille clients échouent au même instant (parce que le serveur est tombé en panne pour tous à la fois), et que tous attendent exactement 500 ms, au bout de 500 ms le serveur reçoit les mille nouvelles tentatives ensemble. C'est la même vague, un peu plus tard. La solution que Marc Brooker a analysée et popularisée sur le blog d'architecture d'AWS en 2015, et qui est aujourd'hui la pratique courante, est de tirer l'attente au sort : le ***jitter* complet** (*full jitter*) attend un temps aléatoire entre 0 et le plafond. Brooker a comparé trois façons de tirer au sort (complet, « égal » et « décorrélé ») : l'« égal » est arrivé en dernier, et entre les deux autres l'écart était moins net. Le cours utilise le complet parce que c'est le plus simple à écrire et à expliquer.

Voici comment cela s'écrit dans `cliente.ts` (extrait) :

```ts
export function esperaConJitter(intento: number, baseMs: number, topeMs: number): number {
  return Math.round(Math.random() * Math.min(topeMs, baseMs * 2 ** intento));
}
```

Pour le voir, `fig06_02.ts` utilise cette même fonction, sans serveur. Enregistre-le dans `~/curso-http/fig06_02.ts`, à côté du dossier `fig06_01/`, parce qu'il importe `./fig06_01/cliente.ts`. D'abord il tire cinq attentes pour chaque tentative ; ensuite il simule mille clients qui échouent au même instant et réessaient une fois, et compte combien de nouvelles tentatives tombent dans chaque fenêtre de 100 ms :

```ts
// fig06_02.ts — el retroceso exponencial, con y sin jitter: cuánto espera cada intento y qué ve el servidor.
// Usa la misma función del revisor. No necesita ningún servidor: solo hace cuentas.
import { esperaConJitter } from "./fig06_01/cliente.ts";

const BASE_MS = 250;
const TOPE_MS = 2000;

// 1. El techo de cada intento: base × 2^intento, sin pasar del tope. El jitter completo sortea entre 0 y el techo.
console.log("intento  techo (ms)  cinco esperas sorteadas (ms)");
for (let intento = 1; intento <= 5; intento++) {
  const techo = Math.min(TOPE_MS, BASE_MS * 2 ** intento);
  const sorteadas = Array.from({ length: 5 }, () => esperaConJitter(intento, BASE_MS, TOPE_MS));
  console.log(`${String(intento).padStart(7)}  ${String(techo).padStart(10)}  ${sorteadas.join(", ")}`);
}

// 2. Mil clientes fallan en el mismo instante y reintentan una vez (intento 1, techo de 500 ms).
// Se cuentan sus reintentos en ventanas de 100 ms, que es lo que el servidor recibe.
const CLIENTES = 1000;
const VENTANA_MS = 100;
function contar(esperas: number[]): number[] {
  const cuentas = Array.from({ length: 6 }, () => 0);
  for (const espera of esperas) cuentas[Math.min(5, Math.floor(espera / VENTANA_MS))]++;
  return cuentas;
}
const sinJitter = contar(Array.from({ length: CLIENTES }, () => Math.min(TOPE_MS, BASE_MS * 2 ** 1)));
const conJitter = contar(Array.from({ length: CLIENTES }, () => esperaConJitter(1, BASE_MS, TOPE_MS)));

console.log();
console.log(`${CLIENTES} clientes reintentan a la vez; reintentos por cada ${VENTANA_MS} ms:`);
console.log("ventana (ms)   sin jitter  con jitter");
for (let i = 0; i < 6; i++) {
  const ventana = i < 5 ? `${i * VENTANA_MS}-${(i + 1) * VENTANA_MS - 1}` : `${i * VENTANA_MS} o más`;
  console.log(`${ventana.padEnd(12)}  ${String(sinJitter[i]).padStart(10)}  ${String(conJitter[i]).padStart(10)}`);
}
console.log(`la ventana más cargada: ${Math.max(...sinJitter)} sin jitter, ${Math.max(...conJitter)} con jitter`);
```

```text
$ node fig06_02.ts
intento  techo (ms)  cinco esperas sorteadas (ms)
      1         500  159, 181, 478, 282, 231
      2        1000  451, 774, 876, 523, 309
      3        2000  205, 575, 343, 1365, 1722
      4        2000  1966, 464, 1257, 575, 492
      5        2000  1555, 1327, 634, 75, 1138

1000 clientes reintentan a la vez; reintentos por cada 100 ms:
ventana (ms)   sin jitter  con jitter
0-99                   0         179
100-199                0         192
200-299                0         190
300-399                0         217
400-499                0         219
500 o más           1000           3
la ventana más cargada: 1000 sin jitter, 219 con jitter
```

Le premier tableau montre le plafond de chaque tentative et la façon dont les attentes tombent n'importe où en dessous : à la tentative 3, elles allaient de 205 à 1 722 ms. À partir de la tentative 3, le plafond est déjà celui de 2 000. Le second tableau est celui qui compte. Sans *jitter*, les mille nouvelles tentatives tombent dans la même fenêtre, celle de 500 ms : le serveur qui était en train de redémarrer reçoit mille requêtes d'un coup. Avec le *jitter*, elles se répartissent en cinq fenêtres d'environ deux cents chacune. C'est la même quantité de travail, mais le pic est cinq fois plus bas. (Les trois qui tombent dans « 500 ou plus » sont ceux qui ont tiré un nombre si proche de 500 que `Math.round` l'a arrondi à 500.) Tes nombres seront différents ; la forme, la même.

#### 6.4.3 `Retry-After` fait autorité, avec un plafond

Quand le serveur dit combien de temps attendre, le client ne devine pas : il obéit. `Retry-After` ([RFC 9110, section 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3)) indique combien de temps l'agent utilisateur devrait attendre avant la requête suivante, en secondes (`120`) ou sous forme de date HTTP. Avec un `503`, il indique combien de temps on s'attend à ce que le service reste indisponible (la même section 10.2.3) ; la [section 15.6.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.4) ajoute que le serveur peut l'envoyer pour suggérer combien de temps attendre avant de réessayer ; avec un `429`, la RFC 6585 permet de l'utiliser pour dire quand revenir. La Leçon 4 t'a appris à le lire de façon stricte : uniquement des chiffres ou l'une des trois formes de date HTTP, toujours en GMT, et tout le reste est ignoré.

Et si le serveur demande d'attendre deux minutes ? Une vérification qui s'endort deux minutes dans un `setTimeout` ne sert à personne : le résultat arrive en retard et, entre-temps, il occupe de la mémoire. C'est pourquoi le `revisor` a un plafond : **si `Retry-After` demande plus de 5 secondes, il n'insiste pas** et consigne dans le résultat ce que le service a dit. C'est la même préoccupation que l'interrogation périodique (polling) de la Leçon 1, qui bornait l'attente entre 1 et 5 secondes pour qu'un serveur fautif ne l'endorme pas pendant une heure, mais ici la décision est autre. Le polling s'enquiert de l'état d'une tâche, une lecture bon marché, et peut redemander au bout de 5 s. Une vérification qui réessaie au bout de 5 s alors que le service en a demandé 120 arrive avant ce que le service a demandé : ce serait lui désobéir. Le plus honnête est de ne pas réessayer et de dire pourquoi. Si `Retry-After` n'arrive pas, ou ne peut pas être lu, on utilise le backoff avec *jitter*.

#### 6.4.4 Les vérifications avec nouvelles tentatives

`revisarConReintentos` assemble le tout (extrait de `cliente.ts` ; le fichier complet est en 6.8.1) :

```ts
const INTENTOS = 3;
const BASE_MS = 250;
const TOPE_MS = 2000;
const TOPE_RETRY_AFTER_S = 5;

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

Lis-le à voix haute : il interroge une fois ; tant qu'il reste des tentatives et que l'échec vaut la peine, il regarde si le service a demandé une attente ; si celui-ci a demandé plus de 5 s, il sort de la boucle ; s'il a demandé quelque chose de raisonnable, il attend cela ; s'il n'a rien demandé, il tire au sort ; et il interroge de nouveau. À la fin, il classe **la dernière** requête, avec la même fonction que d'habitude, que la leçon a séparée de `revisar` pour pouvoir l'utiliser ici. Remarque où se trouve l'attente : dans le corps du `for`, juste avant la requête suivante. Quand les tentatives sont épuisées (`intento < INTENTOS` cesse d'être vrai), le corps ne s'exécute plus, si bien qu'on n'attend jamais après la dernière requête. L'ordre des deux conditions n'y change rien : il évite seulement d'appeler `vale` quand il ne reste plus de tentatives.

Pour le voir à l'œuvre, il faut des services qui échouent de différentes façons. Avec les trois programmes fraîchement démarrés, enregistre trois services du laboratoire : un qui répond `502`, un autre `429` (avec `Retry-After: 30`) et un autre `404`. Demande ensuite une vérification de chacun et une autre de `pagos`, qui répond `503` avec `Retry-After: 120`. Les trois premières avec `escritura-a` et la quatrième avec `admin`, parce que chaque identifiant a trois vérifications par minute (Leçon 4) :

```text
$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"puerta","url":"http://127.0.0.1:18081/codigo/502"}'
201 /servicios/7

$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"cupo","url":"http://127.0.0.1:18081/codigo/429"}'
201 /servicios/8

$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"ausente","url":"http://127.0.0.1:18081/codigo/404"}'
201 /servicios/9

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/7/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/8/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/9/revisiones -H 'Authorization: Bearer admin'
202

$ sleep 4

$ for i in 1 2 3 4; do curl http://127.0.0.1:18080/revisiones/$i -H 'Authorization: Bearer escritura-a'; done
{"id":1,"servicio":2,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":503,"ms":12,"detalle":"503 (reintentar en 120 s)"}}
{"id":2,"servicio":7,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":502,"ms":1,"detalle":"502"}}
{"id":3,"servicio":8,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":429,"ms":1,"detalle":"429 (reintentar en 30 s)"}}
{"id":4,"servicio":9,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":404,"ms":2,"detalle":"404"}}
```

Les quatre résultats disent `CAIDO`, et dans la Leçon 4 ils auraient dit la même chose. La différence se trouve dans le terminal du laboratoire, qui affiche chaque requête qu'il reçoit :

```text
--- terminal del laboratorio:
laboratorio en http://127.0.0.1:18081/codigo/NNN
GET /codigo/503
GET /codigo/502
GET /codigo/429
GET /codigo/404
GET /codigo/502
GET /codigo/502
```

Compte les lignes. `/codigo/503` apparaît **une fois** : il a demandé d'attendre 120 s, plus que le plafond, et le `revisor` n'a pas insisté ; c'est pourquoi le détail conserve `(reintentar en 120 s)`. `/codigo/429` apparaît aussi une fois, pour la même raison (30 s). `/codigo/404` apparaît une fois : un `404` ne s'améliore pas tout seul. Et `/codigo/502` apparaît **trois fois** : la première dans l'ordre avec les autres et les deux autres ensuite, séparées par les attentes tirées au sort (jusqu'à 500 ms et jusqu'à 1 000 ms). Le résultat est celui de la troisième tentative, qui a aussi échoué. Trois tentatives, deux attentes, et pas une de plus.

Si tu te demandes pourquoi la vérification du `502` affiche encore `"ms":1` après près d'une seconde et demie de nouvelles tentatives : `ms` mesure la dernière requête, pas la vérification complète. C'est le temps que le service a mis à répondre, et c'est ce que surveille le `revisor`.

### 6.5 Le `502` qui ne dit pas si l'écriture a eu lieu

#### 6.5.1 La passerelle qui perd des réponses

La seconde moitié de la leçon porte sur la scène d'ouverture. Pour la provoquer à volonté, `pasarela.ts` se place devant le `revisor` et, avec l'en-tête `X-Simular: perder-primera`, laisse passer la première requête de chaque enregistrement, reçoit la réponse du `revisor` et la jette. Au client, elle répond ce que répondrait une vraie passerelle qui n'aurait pas reçu de réponse complète de ce qui est derrière elle : `502 Bad Gateway` ([RFC 9110, section 15.6.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.3)), sous forme de Problem Details avec `about:blank`. Elle reconnaît « la même requête » à son `Idempotency-Key`, et si elle n'en porte pas, à l'empreinte de son corps :

```ts
// fig06_01/pasarela.ts — una pasarela delante del revisor (18082 → 18080) que puede perder respuestas.
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

Remarque ce que la passerelle consigne dans son terminal : « el revisor respondió 201, pero la respuesta se pierde ». Cette ligne, c'est ce que le client ne voit jamais. De son côté, un `502` peut signifier que la requête n'est pas arrivée au `revisor`, ou qu'elle est arrivée et que quelque chose a échoué, ou qu'elle est arrivée, a été exécutée, et que la réponse s'est perdue. **Le `502` ne dit pas lequel**, et il ne peut pas le dire : la passerelle non plus ne le sait pas toujours. Il en va de même pour un `504` et pour une connexion coupée.

La passerelle a un second `502`, qui n'est pas simulé. Si le `revisor` est arrêté ou coupe la connexion, le `fetch` de la passerelle échoue, et une promesse qui échoue sans que personne ne l'attende fait que Node fait planter le processus entier. C'est pourquoi `pasar` est enveloppée dans `pasarSinCaerse` : elle attrape l'échec, consigne « el revisor no respondió », répond `502` avec un autre `detail` (la passerelle n'a pas reçu de *réponse*, et non « une réponse *complète* ») et continue d'écouter. Tu le vois en 6.5.3. Une passerelle qui tombe avec ce qu'elle protège laisse tous ses clients sans même une erreur à lire. Et dans la réponse qu'elle laisse bel et bien passer, elle retransmet, entre autres en-têtes, `content-length`, pour que le client reçoive la même taille que celle donnée par le `revisor` (tu le verras dans le `201` de 6.8.4).

#### 6.5.2 Le client qui réessaie

`alta-segura.ts` est le script de la scène, écrit avec soin : il enregistre un service à travers la passerelle et, s'il reçoit `502`, `503` ou `504`, ou s'il ne reçoit aucune réponse, il attend avec *jitter* et réessaie, jusqu'à quatre tentatives. Il envoie toujours `X-Simular: perder-primera`, pour que la scène se reproduise à volonté ; une vraie passerelle n'obéit jamais à un interrupteur de ce genre venu de la requête d'un client : il est réservé au laboratoire. Avec l'option `--sin-llave`, il se comporte comme le script de la scène ; sans elle, il envoie une `Idempotency-Key` qu'il invente au démarrage :

```ts
// fig06_01/alta-segura.ts — dar de alta un servicio a través de la pasarela y reintentar sin duplicar.
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

La ligne qui compte est celle du commentaire : **une clé par intention, pas par tentative**. La clé est créée une fois, avant la boucle, et toutes les nouvelles tentatives de cet enregistrement la portent. Si elle était créée dans la boucle, chaque nouvelle tentative serait une requête neuve pour le `revisor`, ce qui est exactement le défaut de « L'erreur que tu vas voir ».

Le reste du programme suit l'ordre des deux questions de 6.3.1, et à chaque étape il prend une décision qui se voit dans une exécution (6.5.3 et 6.5.4) :

- **`intentar`** fait une requête et renvoie la réponse (code, corps et `Retry-After`) ou, si aucune n'est arrivée, la cause : le code de l'erreur réseau que signale Node, comme `ECONNREFUSED` (personne n'écoute sur ce port), ou `tiempo agotado`. La requête porte `signal: AbortSignal.timeout(LIMITE_MS)` : si le serveur accepte la connexion et ne répond pas, la tentative est interrompue au bout de 2 000 ms (la variable `ALTA_LIMITE_MS` le modifie, pour tester). Sans cette limite, Node attend 300 s par tentative. Une requête sans réponse est, pour celui qui l'a envoyée, le même cas que le `502` : elle a pu arriver ou non. Avec la même clé, la répéter ne crée pas d'autre service, pourvu que le `revisor` se souvienne encore de cette clé (6.7).
- **`reintentable`** répond à la première question : peut-elle s'améliorer d'elle-même ? Sans réponse, `502`, `503` et `504`, oui. Un `409` aussi, mais seulement celui de `llave-en-curso`, qu'on reconnaît à son `type` et non à son code : la requête d'origine est toujours en cours de traitement et il suffit d'attendre. Le `409` de `nombre-repetido`, un `422` et tout autre `4xx` ne s'améliorent pas en les répétant.
- **Les attentes.** Si le serveur a dit combien de temps attendre (`Retry-After`, lu avec `segundosDeEspera` de `cliente.ts`, la même fonction et le même plafond de 5 s qu'utilisent les vérifications), on obéit ; s'il demande davantage, on n'insiste pas et on dit pourquoi. S'il n'a rien dit, on tire au sort avec *jitter*. La ligne `if (intento === INTENTOS) break;` se place **avant** l'attente, pour qu'après la dernière tentative on n'endorme personne.
- **La fin.** Quand la boucle s'achève, le programme dit pourquoi (une ligne) et sort avec le code qui convient : `0` seulement si l'enregistrement a eu lieu (un `2xx`) ; `1` s'il n'a pas eu lieu ou si on ne le sait pas, que ce soit parce que les tentatives sont épuisées, parce que le serveur a demandé d'attendre trop longtemps ou parce qu'il a répondu quelque chose que répéter ne règle pas. Un script qui appelle `alta-segura.ts` pour quatorze services lit ce code et sait lesquels il doit vérifier.

Commence par la version sans clé. Cette exécution fait partie de la série de 6.6.4, qui a d'abord enregistré `avisos` (7), `correo` (8) et `agenda` (9) ; c'est pourquoi l'id que tu verras est le 10 :

```text
$ node alta-segura.ts nomina2 http://127.0.0.1:18081/codigo/200 --sin-llave; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento sin llave (podría duplicar)
intento 2: 409 {"type":"https://revisor.example/problemas/nombre-repetido","title":"Ya existe un servicio con ese nombre","status":409,"detail":"ya existe un servicio llamado nomina2","instance":"/servicios","existente":"/servicios/10"}
el servidor respondió 409: repetir lo mismo no lo arregla; sin llave no se sabe si lo que ya existe lo creó un intento anterior
(código de salida: 1)
```

La première tentative a reçu `502`. Le client a attendu et réessayé, et la deuxième tentative a reçu `409`, « ya existe un servicio llamado nomina2 », avec `"existente":"/servicios/10"`. Le service 10, c'est la première tentative qui l'a créé : l'écriture a bien eu lieu, le client ne l'a jamais su, et il tient maintenant entre les mains un `409` qui ne lui dit pas si ce service est le sien. C'est la scène, au complet. Sans la règle du nom unique, la deuxième tentative aurait créé le service 11, identique, et personne n'aurait reçu la moindre erreur. Les deux dernières lignes sont celles du programme : il ne répète pas le `409` (attendre ne l'améliore pas), il dit que sans clé il ne sait pas si ce qui existe déjà a été créé par une tentative antérieure, et il sort avec le code `1`.

Que fait un client dans ce cas, sans clé ? **Réconcilier** : relire l'état et décider. Le `409` porte `existente` ; le client peut demander `/servicios/10` et comparer avec ce qu'il voulait créer. S'ils coïncident, il suppose que c'était lui. Cela fonctionne, à moitié : si un collègue a créé un service identique une seconde plus tôt, le client se l'approprie sans le savoir. La Leçon 7 revient sur cette action. La section suivante fait en sorte que le serveur réponde à la question à ta place.

#### 6.5.3 Quand personne ne répond

Jusqu'ici, chaque défaillance a apporté une réponse, fût-ce un `502`. Il reste deux cas plus vilains : la passerelle avec le `revisor` arrêté, et le client sans passerelle. Tous deux sont une forme de « je ne sais pas si c'est passé », et `alta-segura.ts` et `pasarela.ts` les ont réglés. Avec les trois programmes fraîchement démarrés, arrête le `revisor` avec `Ctrl+C` dans son terminal (dans l'exécution de la leçon, il a été arrêté par son PID, et c'est pourquoi on ne voit pas la commande) et redemande un enregistrement, cette fois directement à la passerelle :

```text
$ curl -i -X POST http://127.0.0.1:18082/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"sin-revisor","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 502 Bad Gateway
Content-Type: application/problem+json
Content-Length: 115
Date: Wed, 21 Oct 2026 22:21:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
```

Le `revisor` n'existe plus. La passerelle a répondu `502` avec des Problem Details, et dans son `detail` elle dit ce qui lui est arrivé : « no recibió respuesta del revisor ». Compare avec le `detail` simulé de 6.5.1, « no recibió una respuesta **completa** » : celui-là était un `revisor` qui avait bel et bien répondu et dont la réponse a été jetée ; celui-ci est un `revisor` qui n'a pas répondu. Pour le client, c'est le même `502`, et de nouveau il ne dit pas si l'enregistrement a eu lieu. L'important est que la passerelle **reste en vie** pour répondre : la requête suivante, elle la traite de la même façon.

Voyons maintenant le client. Avec le `revisor` toujours arrêté, `alta-segura.ts` reçoit `502` aux quatre tentatives :

```text
$ node alta-segura.ts sin-revisor http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
  espero entre 0 y 1000 ms y reintento con la misma llave
intento 3: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
  espero entre 0 y 2000 ms y reintento con la misma llave
intento 4: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
se agotaron los 4 intentos sin una respuesta definitiva; repetir más tarde con la llave 9f1d5f3d-0c37-4587-b4fe-5a8056f35347 es seguro
(código de salida: 1)
```

Lis-le ligne par ligne. Les quatre premières lignes qui commencent par `intento` sont les quatre réponses, toutes `502`. Entre elles, trois attentes : jusqu'à 500, jusqu'à 1 000 et jusqu'à 2 000 ms, qui sont les plafonds du backoff pour les tentatives 1, 2 et 3 (`250 × 2^n`, avec un plafond de 2 000). **Il n'y a pas de quatrième attente**, parce qu'après la tentative 4 il n'y a plus rien à réessayer. La ligne suivante dit pourquoi il s'est terminé : « se agotaron los 4 intentos sin una respuesta definitiva ». Et comme l'enregistrement portait une clé, il ajoute la sortie honnête : « repetir más tarde con la llave … es seguro ». Celui qui lit cette ligne (une personne ou un script) a la clé pour réessayer quand le `revisor` reviendra. Mais il ne suffit pas de relancer `alta-segura.ts`, car il inventerait une autre clé : il faut répéter la même requête avec cette clé et les mêmes octets (6.7.2), par exemple avec `curl … -H 'Idempotency-Key: <la llave del mensaje>' -d '{"nombre":"sin-revisor","url":"http://127.0.0.1:18081/codigo/200"}'`. Et la nouvelle tentative n'est protégée que si le serveur se souvient encore de la clé : dans sa durée de validité (6.7.1) et s'il ne l'a pas perdue lors d'un redémarrage (6.7.4). Enfin, `(código de salida: 1)` : le programme ne s'est **pas** terminé avec succès. Le `0` est réservé à un enregistrement qui a eu lieu, si bien qu'un script qui appelle `alta-segura.ts` sur une liste de quatorze services peut regarder ce code et savoir lesquels il doit vérifier. En 6.5.4, tu verras que le `1` couvre aussi un `4xx`.

Le pire cas d'attente est la somme des plafonds : 500 + 1 000 + 2 000 = 3 500 ms, plus le temps que prennent les requêtes. Ici chaque requête a une limite de 2 000 ms, si bien que le pire cas complet est de 4 × 2 000 + 3 500 = 11 500 ms ; sans cette limite il n'y aurait pas de pire cas, parce qu'un serveur qui ne répond pas laisserait le programme attendre 300 s par tentative. Avec la même défaillance, un programme qui attendrait en plus après la quatrième tentative aurait ajouté encore 2 000 ms pour ne rien faire.

La variante sans clé se termine au même point, mais avec un autre message :

```text
$ node alta-segura.ts sin-revisor http://127.0.0.1:18081/codigo/200 --sin-llave; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
  espero entre 0 y 500 ms y reintento sin llave (podría duplicar)
intento 2: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
  espero entre 0 y 1000 ms y reintento sin llave (podría duplicar)
intento 3: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
  espero entre 0 y 2000 ms y reintento sin llave (podría duplicar)
intento 4: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
se agotaron los 4 intentos sin una respuesta definitiva; no se sabe si el alta ocurrió
(código de salida: 1)
```

Les lignes d'attente disent « sin llave (podría duplicar) » à chaque tentative, et la fin ne promet plus rien : « no se sabe si el alta ocurrió ». C'est la même chose qui est arrivée au script de la scène, dite à temps. Sans clé, le programme n'a aucun moyen d'offrir une nouvelle tentative sûre, et il n'en invente pas.

Le dernier cas est celui du client sans passerelle. Arrête aussi la passerelle avec `Ctrl+C` dans son terminal (dans cette série, comme le `revisor`, elle a été arrêtée par son PID, et c'est pourquoi l'exécution ne le montre pas) et enregistre un autre service :

```text
$ node alta-segura.ts sin-pasarela http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: sin respuesta (ECONNREFUSED)
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: sin respuesta (ECONNREFUSED)
  espero entre 0 y 1000 ms y reintento con la misma llave
intento 3: sin respuesta (ECONNREFUSED)
  espero entre 0 y 2000 ms y reintento con la misma llave
intento 4: sin respuesta (ECONNREFUSED)
se agotaron los 4 intentos sin una respuesta definitiva; repetir más tarde con la llave d58f84df-5556-41e5-a63c-5c217e14fb05 es seguro
(código de salida: 1)
```

Maintenant les tentatives ne disent pas `502` : elles disent « sin respuesta (`ECONNREFUSED`) ». Personne n'écoute sur le port 18082, si bien que le système d'exploitation refuse la connexion avant qu'un seul octet de la requête ne voyage. C'est le seul cas de la leçon où tu saurais avec certitude que la requête n'est pas arrivée, mais `alta-segura.ts` ne s'appuie pas là-dessus : il traite toute erreur réseau comme un `502` (elle a pu arriver ou non, et avec la même clé répéter est sûr) et réessaie avec les mêmes plafonds et la même fin. Remarque ce qui n'apparaît **pas** : la pile d'erreurs de Node (`node:internal/modules/run_main…`) avec laquelle se termine un programme qui n'a pas attrapé son `fetch`. Le programme attrape l'erreur, la traduit en une ligne qu'une personne comprend et renvoie le code `1`.

Et le terminal de la passerelle raconte ce qu'elle a vu :

```text
--- terminal de la pasarela:
pasarela en http://127.0.0.1:18082 → http://127.0.0.1:18080
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela: el revisor no respondió
```

Neuf lignes « el revisor no respondió » : une pour la requête de `curl`, quatre pour les tentatives de `sin-revisor` avec clé et quatre pour celles de la variante sans clé. Les quatre tentatives de `sin-pasarela` n'apparaissent pas parce qu'elles ne sont jamais arrivées jusqu'à elle. Trois programmes différents, trois façons d'échouer, et aucun n'a planté ni laissé le client sans une ligne à dire.

#### 6.5.4 Ce qu'il fait de ce qu'il reçoit

Jusqu'ici, `alta-segura.ts` a décidé d'après le code : `502`, `503`, `504` ou pas de réponse, on répète. Mais le serveur dit plus qu'un code, et le programme l'écoute à cinq endroits. Pour les voir, il faut un `revisor` qui réponde des choses que le vrai ne répond pas d'ordinaire, si bien que cette section utilise deux outils : le mode maintenance du `revisor` (`PUT /mantenimiento`, que tu as rencontré dans la Leçon 4) et un serveur simulé, `fig06_04.ts`, qui écoute sur le port 18082 où se trouverait la passerelle et répond ce que tu lui dis.

**Un `4xx` ne se répète pas, et sort avec 1.** Une adresse qui n'est ni `http` ni `https` est un `422` ; répéter la requête identique donnerait le même `422`. Avec la passerelle et le `revisor` fraîchement démarrés :

```text
$ node alta-segura.ts invalida ftp://archivos; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 422 {"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"1 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser una dirección http o https","pointer":"#/url"}]}
el servidor respondió 422: repetir lo mismo no lo arregla
(código de salida: 1)
```

La première tentative a reçu un `502` parce que la passerelle a perdu la réponse (6.5.1) ; la seconde, avec la même clé, est arrivée entière : `422` `datos-invalidos`. Le programme n'attend ni ne réessaie une troisième fois. Il dit en une ligne ce qui s'est passé, « el servidor respondió 422: repetir lo mismo no lo arregla », et sort avec `1`. Un `0` ici dirait à un script que l'enregistrement a eu lieu.

**`Retry-After` fait autorité, avec le même plafond que les vérifications.** Avec le `revisor` en maintenance, toute écriture reçoit un `503` avec `Retry-After: 120` :

```text
$ curl -o /dev/null -w '%{http_code}\n' -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":true}'
204

$ node alta-segura.ts enmantenimiento http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 503 {"type":"https://revisor.example/problemas/en-mantenimiento","title":"El revisor está en mantenimiento","status":503,"detail":"el revisor está en mantenimiento","instance":"/servicios"}
el servidor pidió esperar 120 s (Retry-After), más de los 5 s que este programa espera; no se reintenta; repetir más tarde con la llave bf9d35dc-9d6d-4ca8-9a92-da8dcd058cd3 es seguro
(código de salida: 1)

$ curl -o /dev/null -w '%{http_code}\n' -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":false}'
204
```

Lis-le ainsi : le premier `PUT` active la maintenance (`204`) et le dernier la désactive. Entre les deux, `alta-segura.ts` reçoit le `502` simulé puis le `503` de la maintenance. Cette fois il ne tire pas d'attente au sort : il lit `Retry-After: 120`, voit que cela dépasse le plafond de 5 s et s'arrête avec le message « el servidor pidió esperar 120 s (Retry-After), más de los 5 s que este programa espera; no se reintenta », plus la clé au cas où quelqu'un voudrait répéter plus tard. C'est la même règle que 6.4.3, avec la même fonction (`segundosDeEspera`) et le même plafond.

Pour voir l'autre côté, il faut un serveur qui demande une attente courte. C'est là qu'intervient le serveur simulé :

```ts
// fig06_04.ts — un servidor de mentira en el 18082 (donde estaría la pasarela) que contesta lo que le digas.
// Uso: node fig06_04.ts <respuesta>...    (una respuesta por petición; la última se repite)
//   201           responde 201 con un cuerpo de juguete
//   503:2         responde 503 con «Retry-After: 2» (el número después de los dos puntos son los segundos)
//   409:en-curso  responde el 409 de «llave en curso»; 409 a secas es otro 409
//   mudo          acepta la conexión y no contesta nunca
import { createServer } from "node:http";

const pedidas = process.argv.slice(2);
if (pedidas.length === 0) {
  console.error("uso: node fig06_04.ts <respuesta>...   (por ejemplo: 503:2 201)");
  process.exit(2);
}
let peticiones = 0;
createServer((peticion, respuesta) => {
  peticion.resume();
  const pedida = pedidas[Math.min(peticiones, pedidas.length - 1)];
  peticiones++;
  console.log(`petición ${peticiones}: ${pedida}`);
  if (pedida === "mudo") return;
  const [codigo, extra] = pedida.split(":");
  const estado = Number(codigo);
  const bien = estado < 300;
  const cabeceras: Record<string, string> = { "Content-Type": bien ? "application/json" : "application/problem+json" };
  if (!bien && extra !== undefined && extra !== "en-curso") cabeceras["Retry-After"] = extra;
  const tipo = estado === 409 && extra === "en-curso" ? "https://revisor.example/problemas/llave-en-curso" : "about:blank";
  const cuerpo = bien ? { id: 99 } : { type: tipo, title: "respuesta de mentira", status: estado };
  respuesta.writeHead(estado, cabeceras);
  respuesta.end(JSON.stringify(cuerpo) + "\n");
}).listen(18082, "127.0.0.1", () => console.log("servidor de mentira en http://127.0.0.1:18082"));
```

Une réponse par requête, et la dernière se répète. `503:2` est un `503` avec `Retry-After: 2` ; `409:en-curso` est le `409` de la clé en cours (avec son `type`, ce que regarde `alta-segura.ts`) ; `mudo` accepte la connexion et ne répond pas. Arrête la passerelle avec `Ctrl+C` (dans l'exécution, par son PID) et démarre le serveur simulé à sa place, dans un autre terminal. D'abord, un `503` qui demande deux secondes puis un `201` :

```text
$ node fig06_04.ts 503:2 201

$ node alta-segura.ts paciente http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 503 {"type":"about:blank","title":"respuesta de mentira","status":503}
  el servidor pide esperar 2 s (Retry-After); espero 2 s y reintento con la misma llave
intento 2: 201 {"id":99}
(código de salida: 0)

--- terminal del servidor de mentira:
servidor de mentira en http://127.0.0.1:18082
petición 1: 503:2
petición 2: 201
```

La ligne d'attente a changé de forme : « el servidor pide esperar 2 s (Retry-After); espero 2 s y reintento con la misma llave ». Ce n'est plus un tirage entre 0 et un plafond, c'est ce que le serveur a demandé. La deuxième tentative reçoit le `201` et le programme sort avec `0`. Le terminal du serveur simulé confirme qu'il a reçu exactement deux requêtes.

**Le `409` de « clé en cours » n'est pas définitif.** C'est le `409` que tu as vu en 6.6.4 : la requête d'origine est toujours en cours d'enregistrement. Un client qui reçoit ce `409` n'a rien à corriger ; il attend et répète. `alta-segura.ts` le reconnaît au `type` des Problem Details (pas au titre ni au détail) et le traite comme n'importe quelle défaillance passagère :

```text
$ node fig06_04.ts 409:en-curso 201

$ node alta-segura.ts en-curso http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 409 {"type":"https://revisor.example/problemas/llave-en-curso","title":"respuesta de mentira","status":409}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 201 {"id":99}
(código de salida: 0)

--- terminal del servidor de mentira:
servidor de mentira en http://127.0.0.1:18082
petición 1: 409:en-curso
petición 2: 201
```

Le même `409` avec un autre `type` (celui qu'utilise le `revisor` pour un nom en double) n'est pas réessayé : répéter ne changerait pas le nom.

```text
$ node fig06_04.ts 409

$ node alta-segura.ts repetida http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 409 {"type":"about:blank","title":"respuesta de mentira","status":409}
el servidor respondió 409: repetir lo mismo no lo arregla
(código de salida: 1)

--- terminal del servidor de mentira:
servidor de mentira en http://127.0.0.1:18082
petición 1: 409
```

Une seule requête dans le terminal du serveur simulé, `1` en sortie. Deux `409`, deux décisions, et ce qui les sépare, c'est le `type`. C'est l'idée que la Leçon 7 transforme en table.

Quand voit-on le `409` « en cours » avec le vrai `revisor` ? Avec la limite de 2 000 ms par défaut, presque jamais : le `revisor` met 500 ms à sauvegarder, si bien que lorsqu'une tentative est interrompue par le délai, l'originale est déjà terminée et la nouvelle tentative reçoit le `201` enregistré. Il n'apparaît que si la limite est inférieure à la durée de sauvegarde. On l'a mesuré en abaissant la limite à 150 ms avec `ALTA_LIMITE_MS=150` et en répétant l'enregistrement jusqu'à ce que la nouvelle tentative arrive avant que l'originale ne soit terminée, et il faut le répéter plusieurs fois parce que cela dépend du moment où tombe l'attente tirée au sort. C'est pourquoi on l'éprouve avec le serveur simulé, qui répond ce qu'on lui dit.

**Un serveur qui ne répond pas est interrompu par un délai.** Chaque tentative porte une limite (2 000 ms par défaut). Avec `ALTA_LIMITE_MS=300`, pour ne pas attendre autant pendant l'exécution :

```text
$ node fig06_04.ts mudo

$ ALTA_LIMITE_MS=300 node alta-segura.ts muda http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: sin respuesta (tiempo agotado: 300 ms)
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: sin respuesta (tiempo agotado: 300 ms)
  espero entre 0 y 1000 ms y reintento con la misma llave
intento 3: sin respuesta (tiempo agotado: 300 ms)
  espero entre 0 y 2000 ms y reintento con la misma llave
intento 4: sin respuesta (tiempo agotado: 300 ms)
se agotaron los 4 intentos sin una respuesta definitiva; repetir más tarde con la llave f4e16950-99e9-4504-86b8-c95e2c52cc04 es seguro
(código de salida: 1)

--- terminal del servidor de mentira:
servidor de mentira en http://127.0.0.1:18082
petición 1: mudo
petición 2: mudo
petición 3: mudo
petición 4: mudo
```

Chaque tentative est interrompue au bout de 300 ms et le programme la compte comme « sin respuesta (tiempo agotado: 300 ms) » : c'est le même cas que le `502` ou la connexion refusée, et elle est réessayée de la même façon. Quatre tentatives, quatre requêtes dans le terminal du serveur, et la sortie honnête habituelle. Sans la limite, la première tentative mettrait environ 300 s à abandonner.

### 6.6 `Idempotency-Key` : un brouillon, pas un standard

#### 6.6.1 Ce que c'est et où elle en est

L'idée est ancienne et beaucoup de grandes API l'utilisent : le client invente un identifiant unique pour chaque opération qu'il veut faire une seule fois, l'envoie dans un en-tête, et le serveur se souvient de ce qu'il a répondu à cet identifiant. S'il arrive de nouveau, au lieu de traiter la requête une autre fois, il répète la réponse qu'il a déjà donnée. La documentation de Stripe l'explique ainsi : si une erreur de connexion survient, tu peux répéter la requête sans risquer de créer un second objet ni d'appliquer le changement deux fois.

Le groupe de travail `httpapi` de l'IETF a tenté de standardiser cet en-tête sous le nom `Idempotency-Key`. La dernière version est [`draft-ietf-httpapi-idempotency-key-header-07`](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07), du 15 octobre 2025, de Jayadeba Jena et Sanjay Dalal, et elle **a expiré le 18 avril 2026 sans être publiée comme RFC**. La page du document sur le Datatracker de l'IETF l'indique comme « Expired Internet-Draft » : son statut prévu était Standards Track, mais aucune RFC n'en est sortie. Dit sans détour : **`Idempotency-Key` n'est pas un standard**. C'est un brouillon expiré qui décrit un schéma que beaucoup de gens utilisaient déjà. Le brouillon lui-même cite dans sa section sur les implémentations Stripe, Adyen et Yandex avec un en-tête portant ce nom, et d'autres qui font la même chose sous un autre nom (PayPal utilise `PayPal-Request-Id`).

Pourquoi l'utiliser, alors ? Parce que le schéma est bon, parce que le nom est celui que la plupart reconnaissent, et parce que le brouillon décrit avec soin les cas difficiles. Mais ton API doit le **documenter comme un comportement qui lui est propre**, et non comme quelque chose que HTTP garantit. Le brouillon lui-même le demande : les ressources qui l'utilisent doivent publier leur spécification d'idempotence (section 2.5.2), et un client générique ne peut pas supposer qu'un serveur la respecte (section 2.5.1). Un en-tête que le serveur ne connaît pas est ignoré en silence : si tu envoies `Idempotency-Key` à une API qui ne l'implémente pas, ta nouvelle tentative duplique quand même.

#### 6.6.2 Ce que propose le brouillon

L'essentiel du brouillon, section par section, et ce que fait le `revisor` de chaque élément :

- **Syntaxe (2.1).** La valeur est une *String* des champs structurés de HTTP, c'est-à-dire qu'elle **va entre guillemets** : `Idempotency-Key: "8e03978e-40d5-43e8-bc93-6894a57f9324"`. Le `revisor` simplifie : il prend la valeur telle qu'elle arrive, sans retirer les guillemets. Pour lui, `alta-avisos-1` et `"alta-avisos-1"` sont deux clés distinctes (tu le verras en 6.7.4). Les requêtes de cette leçon envoient la clé sans guillemets, comme le font beaucoup d'API nées avant le brouillon ; si tu implémentes le schéma de zéro, accepte la forme du brouillon.
- **Unicité (2.2).** La clé doit être unique et ne doit pas être réutilisée avec une autre requête dont le corps diffère. Le brouillon recommande un UUID ou un autre identifiant aléatoire. `alta-segura.ts` utilise `randomUUID()` ; les requêtes `curl` de la leçon utilisent des noms lisibles comme `alta-avisos-1` pour que tu puisses lire les exécutions, et dans un vrai client tu ne le ferais pas (section 6.7.5).
- **Durée de validité (2.3).** La ressource peut faire expirer les clés, et doit publier cette politique. C'est la section 6.7.1.
- **Empreinte (2.4).** Avec la clé, le serveur peut calculer une empreinte du corps (une somme de contrôle du corps entier, de certains champs, ou une comparaison champ par champ) pour savoir si la requête répétée est vraiment la même. Le `revisor` utilise SHA-256 sur le JSON déjà lu.
- **Quoi faire (2.6).** Si la clé est nouvelle, on traite normalement. Si elle a déjà été traitée et que la requête est la même, on répond ce qui a été répondu la première fois. Si elle arrive alors que l'originale est toujours en cours, on répond par un conflit.
- **Les erreurs (2.7).** `422 Unprocessable Content` si la clé est réutilisée avec un autre corps ; `409 Conflict` si elle arrive alors que l'originale est toujours en cours ; `400` si une opération exige la clé et qu'elle ne vient pas. Les exemples du brouillon répondent avec des Problem Details. Le brouillon ajoute une règle pour le client : avant de réessayer après l'une de ces erreurs, le client doit corriger la requête, **sauf avec le `409`**, qui ne demande pas de correction mais de la patience.

Dans le `revisor`, la clé est **optionnelle**, il n'y a donc pas de `400`. Les deux autres cas sont les deux nouveaux types du catalogue : `llave-reutilizada` (`422`) et `llave-en-curso` (`409`). Le `409` de la clé est un `409` distinct de celui de `nombre-repetido`, et la Leçon 3 l'avait déjà annoncé : les deux sont des conflits avec l'état actuel, mais celui de la clé se résout en attendant et celui du nom, en relisant. C'est pourquoi ils ont un `type` différent, et pourquoi la Leçon 7 décide d'après le `type`, pas d'après le code.

#### 6.6.3 `idempotencia.ts`

```ts
// fig06_01/idempotencia.ts — Idempotency-Key: repetir un POST sin duplicar lo que creó.
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

Quatre fonctions et un registre. `huella` résume le corps ; `tomarTurno` est celle qui décide : elle cherche la clé **dans l'identifiant** (`${credencial}:${llave}`), et si elle n'existe pas, elle la met de côté avec son empreinte et sans réponse enregistrée (`grabada: null`), ce qui signifie « en cours ». Si elle existe avec une autre empreinte, c'est `otra-peticion` ; si elle existe sans réponse enregistrée, `en-curso` ; si elle existe avec une réponse, `repetir`. `grabar` enregistre la réponse quand l'enregistrement se termine bien. `soltar` supprime l'entrée quand l'enregistrement échoue sans rien créer, pour qu'une nouvelle tentative corrigée puisse passer.

Et l'enregistrement, dans `servicios.ts`, l'utilise ainsi (extrait ; le fichier complet est en 6.8.1) :

```ts
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
```

L'endroit où se trouve ce bloc compte autant que ce qu'il fait. Il vient **après** `leerJson`, si bien qu'un corps qui n'est pas du JSON, qui dépasse 16 KiB ou qui n'est pas un objet est rejeté avant qu'on regarde la clé, comme dans la Leçon 5 : il n'y a pas d'empreinte possible pour quelque chose qu'on n'a pas pu lire. Et il vient **avant** `validar`, la vérification de la destination et la recherche du nom, parce que la clé doit être mise de côté avant que ne commence le travail qui pourrait être dupliqué. Si l'une de ces trois choses échoue, l'enregistrement appelle `soltar`. Si tout se passe bien, l'enregistrement construit la réponse, l'enregistre et l'envoie.

Pour qu'on puisse voir le `409` « en cours », l'enregistrement attend 500 ms simulées avant de sauvegarder (`GUARDAR_MS`). Dans une vraie API, cette attente, c'est la base de données, une autre API ou une file : le temps pendant lequel la clé est mise de côté et la réponse n'existe pas encore.

#### 6.6.4 La même clé, trois issues

Avec les trois programmes fraîchement démarrés, envoie le même enregistrement deux fois avec la même clé :

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-0cabc364"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 22:26:31 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-0cabc364"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 22:26:31 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

Deux réponses identiques, octet pour octet : le même `201`, le même `Location: /servicios/7`, le même `ETag`. Le second `POST` n'a rien créé : le terminal du `revisor` le dit, `idempotencia: la llave alta-avisos-1 ya se atendió; repito su respuesta`. Le client qui réessaie reçoit ce qu'il aurait reçu la première fois, et n'a aucun `409` à interpréter.

Maintenant la même clé avec un autre corps, un autre nom :

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 228
Date: Wed, 21 Oct 2026 22:26:31 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/llave-reutilizada","title":"Esa Idempotency-Key ya se usó con otra petición","status":422,"detail":"la llave alta-avisos-1 ya se usó con un cuerpo distinto","instance":"/servicios"}
```

`422`, `llave-reutilizada`. Le `revisor` ne répète pas la réponse d'`avisos` (cela ferait croire au client que `correo` a été créé) ni ne crée `correo` (la clé avait déjà un propriétaire). Il répond que le client a mal utilisé la clé, et le brouillon demande au client de corriger avant de réessayer : une nouvelle clé pour une nouvelle opération.

Et deux requêtes avec la même clé presque en même temps. La première est envoyée en arrière-plan et la seconde 100 ms plus tard, alors que la première est encore dans les 500 ms de sauvegarde :

```text
$ ( curl -o /dev/null -w 'primera: %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-correo-1' -d '{"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200"}' & sleep 0.1; curl -w '\nsegunda: %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-correo-1' -d '{"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200"}'; wait )
{"type":"https://revisor.example/problemas/llave-en-curso","title":"Esa Idempotency-Key sigue en curso","status":409,"detail":"la petición original con la llave alta-correo-1 todavía no termina","instance":"/servicios"}

segunda: 409
primera: 201
```

La seconde a reçu `409` `llave-en-curso` et s'est terminée la première ; la première s'est terminée ensuite avec `201`. Si le `revisor` ne mettait pas la clé de côté au début, la seconde ne recevrait pas `llave-en-curso` : elle attendrait ses 500 ms, trouverait le `correo` que vient de créer la première et répondrait `409 nombre-repetido`. (On l'a mesuré : deux enregistrements sans clé avec le même nom, le second 100 ms plus tard, ont donné `201` et `409`, et il n'est resté qu'un seul `correo` ; dans le `revisor`, chercher le nom et créer le service se font ensemble, sans aucun `await` entre les deux.) C'est le doute de la scène : un `409` qui ne dit pas si le service est le tien. Et dans un `POST` sans champ unique, comme demander une vérification, les deux auraient créé quelque chose. Mettre la clé de côté sans aucun `await` entre les deux (`tomarTurno`) transforme ce doute en une réponse claire : « ta requête d'origine est toujours en cours ». Un client qui reçoit ce `409` n'a rien à corriger : il attend un peu et répète, et recevra le `201` enregistré. `alta-segura.ts` le fait (6.5.4).

#### 6.6.5 Le client qui réessaie avec la même clé

Voici maintenant la scène avec clé. Dans la même série :

```text
$ node alta-segura.ts agenda http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 201 {"id":9,"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
(código de salida: 0)
```

La première tentative a reçu `502` : le `revisor` a créé `agenda` (id 9) et la passerelle a jeté la réponse. La deuxième tentative portait la même clé, le `revisor` l'a reconnue et a répété son `201` avec le corps d'`agenda`. Cette fois, la passerelle l'a laissé passer parce qu'elle avait déjà vu cette clé. **Le client a reçu la réponse qui s'était perdue**, et n'a rien eu à deviner.

La liste de l'équipe et les deux terminaux confirment que rien n'a été dupliqué :

```text
$ curl http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a'
{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/lento/1500","limite_ms":2000},{"id":5,"nombre":"reportes","url":"http://127.0.0.1:18081/lento/3000","limite_ms":1000},{"id":6,"nombre":"facturacion","url":"http://127.0.0.1:18081/basura","limite_ms":2000},{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":8,"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":9,"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":10,"nombre":"nomina2","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}

--- terminal del revisor:
revisor en http://127.0.0.1:18080
POST /servicios
POST /servicios
idempotencia: la llave alta-avisos-1 ya se atendió; repito su respuesta
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
idempotencia: la llave bf0d47f7-f895-4945-8e27-2215869c5fc8 ya se atendió; repito su respuesta
POST /servicios
POST /servicios
GET /servicios

--- terminal de la pasarela:
pasarela en http://127.0.0.1:18082 → http://127.0.0.1:18080
pasarela: el revisor respondió 201, pero la respuesta se pierde
pasarela: el revisor respondió 201, pero la respuesta se pierde
```

Un service par nom : `avisos` (7), `correo` (8), `agenda` (9) et `nomina2` (10, celui de la section 6.5.2, exécuté dans cette même série). Dans le terminal du `revisor`, il y a deux lignes d'idempotence : celle d'`alta-avisos-1` et celle de la clé qu'a inventée `alta-segura.ts`. Dans celui de la passerelle, deux réponses perdues, celle d'`agenda` et celle de `nomina2`, toutes deux d'un `201`. L'écriture a eu lieu dans les deux cas ; la différence est qu'avec une clé, le client l'a su.

### 6.7 Les limites de la clé

Jusqu'ici, la clé semble magique. Elle ne l'est pas, et promettre « répète sans rien dupliquer » sans dire où s'arrête la promesse est une façon de mentir. Voici ses frontières, chacune avec une exécution. Toutes proviennent d'une nouvelle série, avec les trois programmes fraîchement démarrés.

#### 6.7.1 Combien de temps elle dure

Dans le `revisor`, une clé dure **aussi longtemps que le processus** : l'entrée vit dans une `Map` en mémoire, sans expiration, et se perd au redémarrage. C'est le minimum pour enseigner, et cela pose deux problèmes dans une vraie API : la mémoire grossit à chaque enregistrement, et un redémarrage oublie toutes les clés (tu le vois à la fin de cette section).

Le brouillon laisse la durée à chaque API, avec une condition : qu'elle la publie (section 2.3). Stripe, par exemple, documente qu'il peut supprimer les clés lorsqu'elles ont au moins 24 heures, et que si une clé est réutilisée après avoir été supprimée, la requête est traitée comme nouvelle. C'est la frontière qu'il faut comprendre : **une fois la clé expirée, la nouvelle tentative n'est plus protégée**. Si ton client réessaie pendant des heures (une file qui s'engorge, un travail qui reprend le lendemain), il doit réessayer dans la durée de validité, ou accepter qu'il puisse dupliquer. L'exercice 3 te demande d'ajouter une durée de validité à `idempotencia.ts` et de voir ce qui se passe quand elle expire.

#### 6.7.2 Ce qui se passe si le corps change

« Le même corps » dépend de la façon de calculer l'empreinte. Le `revisor` la calcule sur le JSON **déjà lu**, avec `JSON.stringify(datos)`. Cela a des conséquences qu'il vaut la peine de voir :

```text
$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
201 /servicios/7

$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{ "nombre" : "avisos" ,  "url" : "http://127.0.0.1:18081/codigo/200" }'
201 /servicios/7

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"url":"http://127.0.0.1:18081/codigo/200","nombre":"avisos"}'
{"type":"https://revisor.example/problemas/llave-reutilizada","title":"Esa Idempotency-Key ya se usó con otra petición","status":422,"detail":"la llave alta-avisos-1 ya se usó con un cuerpo distinto","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}'
{"type":"https://revisor.example/problemas/llave-reutilizada","title":"Esa Idempotency-Key ya se usó con otra petición","status":422,"detail":"la llave alta-avisos-1 ya se usó con un cuerpo distinto","instance":"/servicios"}
 [422]
```

Le premier `POST` crée `avisos`. Le deuxième apporte les mêmes données avec des espaces partout, et le `revisor` répète le `201` : les espaces se perdent à la lecture du JSON, si bien que l'empreinte est la même. Le troisième apporte les mêmes deux champs **dans un autre ordre**, et le `revisor` répond `422` : `JSON.stringify` respecte l'ordre dans lequel les champs sont arrivés, si bien que pour l'empreinte c'est un autre corps. Et le quatrième ajoute `"limite_ms":2000`, qui est précisément la valeur par défaut : le service qui en résulterait est identique, et c'est pourtant un `422`.

Est-ce un tort ? C'est une décision, et c'est la prudente. Le brouillon accepte plusieurs formes d'empreinte (2.4), et toutes posent le même dilemme : une empreinte stricte rejette des requêtes qui « signifient » la même chose, et une empreinte souple accepte des requêtes qui ne sont pas les mêmes. Le `revisor` préfère rejeter : un `422` dit au client que quelque chose a changé, et le client peut le corriger ; accepter un corps différent comme s'il était le même masque l'erreur (c'est le deuxième défaut de « L'erreur que tu vas voir »). La conséquence pour le client est simple : **une nouvelle tentative envoie les mêmes octets que l'original**, pas « un corps équivalent ». `alta-segura.ts` le respecte parce qu'il construit le corps une fois par tentative avec les mêmes données et dans le même ordre.

#### 6.7.3 Ce qui se passe si l'enregistrement échoue

```text
$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-agenda-1' -d '{"nombre":"agenda","url":"ftp://agenda"}'
{"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"1 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser una dirección http o https","pointer":"#/url"}]}
 [422]

$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-agenda-1' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200"}'
201 /servicios/8
```

Le premier `POST` avec `alta-agenda-1` apporte une adresse `ftp` et reçoit `422` `datos-invalidos`. Le second, avec la même clé et l'adresse corrigée, crée le service. Si le `revisor` avait enregistré le `422`, la nouvelle tentative corrigée aurait reçu de nouveau le `422` (ou un `422` de clé réutilisée, parce que le corps a changé) : le client n'aurait pas pu corriger son erreur sans inventer une autre clé.

Ici, le `revisor` s'écarte volontairement de la lettre du brouillon. La section 2.6 dit que, si la requête est réessayée alors que l'originale est déjà terminée, on répond le résultat de l'opération précédente, « success or an error ». Le `revisor` **n'enregistre que les succès**, et libère la clé quand l'enregistrement échoue sans rien créer : données impossibles, destination interdite ou nom en double. La raison est que ces erreurs n'ont aucun effet à protéger ; il n'y a rien à dupliquer. Stripe va plus loin que le `revisor` dans l'autre sens : dans son API v1, il enregistre le code et le corps de la première requête dès que le point d'accès commence à s'exécuter, y compris les erreurs `500`, et n'écarte que deux cas : quand les paramètres ne passent pas la validation et quand la requête heurte une autre requête en cours d'exécution ; ces deux-là peuvent être réessayées. La coïncidence avec le `revisor` se trouve dans ces deux cas ; la différence, c'est que le `revisor` n'enregistre pas non plus les erreurs qui surviennent après, et qu'il peut libérer la clé parce que ses trois erreurs surviennent avant de créer quoi que ce soit. Si ton API a des opérations qui échouent *à moitié* (elle a débité, mais n'a pas sauvegardé le reçu), cette politique ne suffit plus : il faut enregistrer l'erreur, ou mieux, terminer le travail en attente.

#### 6.7.4 Ce que la clé ne couvre pas

**La réponse enregistrée n'est pas l'état actuel.** Dans la même série, retire le service 7 et répète l'enregistrement d'origine d'`avisos` avec sa clé :

```text
$ curl -o /dev/null -w '%{http_code}\n' -X DELETE http://127.0.0.1:18080/servicios/7 -H 'Authorization: Bearer escritura-a'
204

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-5f8dc707"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 22:25:53 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/7 -H 'Authorization: Bearer escritura-a'
410
```

Le `revisor` a fidèlement répété son `201` avec `Location: /servicios/7`, et `/servicios/7` répond `410`. Ce n'est pas une erreur : la clé promet la même *réponse*, pas que la ressource soit toujours là. Un client qui réessaie et reçoit la réponse enregistrée sait que son opération a eu lieu une fois ; ce qui est arrivé ensuite à la ressource est une autre question, et on y répond en la lisant.

**La clé appartient à celui qui l'envoie.** `escritura-b` utilise la même clé `alta-agenda-1` avec le même corps :

```text
$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-b' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-agenda-1' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200"}'
201 /servicios/9
```

`201`, un nouveau service, le 9, de l'équipe b. Pour le `revisor`, ce n'est pas la même clé, parce que l'entrée est tenue par identifiant (`${credencial}:${llave}`). C'est ce que demande la section de sécurité du brouillon, et l'encadré 6.7.5 l'explique.

**Le texte exact de la clé.** La même clé entre guillemets, comme l'écrit le brouillon :

```text
$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: "alta-agenda-1"' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200"}'
409 
```

Pour le `revisor`, `"alta-agenda-1"` avec guillemets est une autre clé, si bien que l'enregistrement a été traité comme nouveau et qu'il a été arrêté par le filet du nom en double (`409`, sans `Location`). Un client qui suivrait le brouillon à la lettre et un serveur qui ne retire pas les guillemets ne se comprennent pas ; c'est pourquoi le brouillon demande de publier le format de la clé et de le valider.

**Un redémarrage.** On arrête le `revisor`, on le redémarre, et on répète l'enregistrement d'`agenda` avec la clé qui avait déjà fonctionné :

```text
$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-agenda-1' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200"}'
201 /servicios/7

--- terminal del revisor:
revisor en http://127.0.0.1:18080
POST /servicios
POST /servicios
idempotencia: la llave alta-avisos-1 ya se atendió; repito su respuesta
POST /servicios
POST /servicios
POST /servicios
POST /servicios
DELETE /servicios/7
POST /servicios
idempotencia: la llave alta-avisos-1 ya se atendió; repito su respuesta
GET /servicios/7
POST /servicios
POST /servicios
revisor en http://127.0.0.1:18080
POST /servicios
```

`201` avec l'id 7 : un `revisor` fraîchement démarré ne se souvient ni de la clé ni du service. Dans ce cours, cela ne fait pas de mal, parce que tout s'est perdu ensemble ; dans une vraie API qui stocke les services dans une base de données et les clés en mémoire, le redémarrage oublierait les clés et conserverait les services, et la nouvelle tentative dupliquerait. **Les clés se stockent là où se stocke ce qu'elles protègent**, et si possible dans la même transaction.

Et il y a deux frontières qui n'ont pas besoin d'exécution. La clé **ne protège que ce que fait le `revisor`** : si l'enregistrement envoyait un courriel de bienvenue ou appelait une autre API, la clé du `revisor` n'empêche pas ce courriel ou cet appel de se répéter, à moins de les protéger eux aussi. Et la clé **n'existe que sur `POST /servicios`**. Demander une vérification, `POST /servicios/{id}/revisiones`, n'a pas de clé dans ce cours : deux requêtes créent deux vérifications, comme tu l'as vu en 6.2.2. Les `PUT` et `DELETE` n'en ont pas besoin, parce qu'ils sont déjà idempotents ; Stripe dit la même chose de ses `GET` et `DELETE` : y envoyer une clé n'a aucun effet.

#### 6.7.5 Encadré de sécurité : la clé appartient à celui qui l'envoie

Une table de clés est, en pratique, un cache de réponses : celui qui présente la clé reçoit la réponse enregistrée. Si le `revisor` cherchait la clé seule, sans l'identifiant, quiconque devinerait la clé d'une autre équipe recevrait le `201` de cette équipe, avec l'id, le nom et l'adresse du service. Le brouillon l'avertit dans sa section de sécurité : une implémentation qui accepte des clés de faible entropie permet à un attaquant de deviner celles d'autres clients et de lire leurs réponses stockées. Et il propose deux défenses. Le `revisor` a la première : une clé composée, qui combine la clé du client avec quelque chose que seul le serveur connaît du client (ici, l'identifiant avec lequel il s'est authentifié). La seconde, un format fixe et publié pour la clé, validé avant de traiter quoi que ce soit, il ne l'a qu'à moitié : il exige seulement qu'elle ne soit pas vide. Une vraie API demanderait un UUID.

Deux choses de plus. Les clés lisibles des requêtes de cette leçon, comme `alta-avisos-1`, sont là pour que tu puisses lire les exécutions : un vrai client utilise un UUID aléatoire, comme `alta-segura.ts`. Et la clé ne doit pas contenir de données personnelles : la documentation de Stripe demande de ne pas utiliser de courriels ni d'identifiants de personnes, parce que la clé finit dans des journaux. Dans le `revisor` aussi : le terminal consigne la clé (`idempotencia: la llave … ya se atendió`), jamais l'identifiant.

### 6.8 Le `revisor` complet

#### 6.8.1 Les fichiers qui changent

Si tu as le dossier de la Leçon 5, copie-le sous `~/curso-http/fig06_01/`. Tu as déjà vu en entier `idempotencia.ts` (6.6.3), `pasarela.ts` (6.5.1) et `alta-segura.ts` (6.5.2). Voici les quatre autres qui changent.

`problemas.ts` : deux nouveaux types dans le catalogue, `llave-en-curso` et `llave-reutilizada`.

```ts
// fig06_01/problemas.ts — el manejador central de errores: cada error sale como Problem Details (RFC 9457).
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

`cliente.ts` : `clasificar` sort de `revisar` pour que `revisarConReintentos` puisse l'utiliser avec la dernière requête, et à la fin arrivent le backoff avec *jitter* et les nouvelles tentatives.

```ts
// fig06_01/cliente.ts — la cara cliente del revisor: consulta un servicio y clasifica lo que respondió.
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

`servicios.ts` : l'enregistrement lit `Idempotency-Key`, met la clé de côté, la libère s'il échoue et enregistre la réponse s'il réussit ; les vérifications utilisent `revisarConReintentos`.

```ts
// fig06_01/servicios.ts — lo que hace cada ruta de la API del revisor.
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

`respuestas.ts` : le `413` ne perd plus la situation de compétition (race condition) contre un client qui continue d'envoyer. Dans les leçons précédentes, quand le corps dépassait le plafond, le `revisor` répondait `413` avec `Connection: close` et Node détruisait la connexion dès qu'il avait fini de répondre. Si le client était encore en train d'envoyer, ce qui arrivait sur une connexion déjà fermée recevait un `RST` du système d'exploitation, et ce `RST` peut effacer le `413` avant que le client ne le lise ([RFC 9112, section 9.6](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.6)). Le client voyait `EPIPE` ou `ECONNRESET` au lieu d'un `413`. La même section recommande de fermer par étapes : répondre, fermer seulement l'écriture (demi-fermeture), continuer à lire un moment et, seulement alors, fermer complètement. C'est ce que fait `cerrarConCalma` : Node, en terminant une réponse avec `Connection: close`, appelle `socket.destroySoon()`, qui ferme et détruit ; sur cette connexion, on remplace cette méthode par une qui ne ferme que l'écriture (`socket.end()`), on continue de lire en jetant ce qui arrive (`peticion.resume()`), et un minuteur de 2 secondes détruit la connexion si le client ne la ferme pas avant. Le `413` part immédiatement, sans attendre que le client ait fini d'envoyer.

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

On l'a mesuré isolément, contre un `revisor` fraîchement démarré, avec 400 requêtes consécutives de 20 000 octets envoyés par morceaux (20 morceaux de 1 000 octets, avec le `fetch` de Node) : sans la fermeture par étapes, 380 ont donné `413` et 20 ont échoué (17 avec `EPIPE` et 3 avec `ECONNRESET`) ; avec elle, 400 sur 400. Avec de gros corps, de 3 MiB et de 20 MiB envoyés par morceaux, 100 sur 100 ont donné `413`. Avec `Content-Length` de 20 000 octets et avec `curl -T -`, ils ont donné 400 sur 400 dans toutes les versions : la situation de compétition existait, mais elle apparaît surtout quand le client envoie par morceaux. Un client qui ne ferme pas son côté ne retient pas la connexion : le `revisor` la détruit au bout de 2 secondes (la connexion passe par `FIN_WAIT_2` et à 3,5 s elle n'existe plus). Le fichier complet est en 6.8.2.

#### 6.8.2 Les fichiers qui ne changent pas

Les autres fichiers sont ceux de la Leçon 5, sans un seul changement, sauf deux qui figurent ici en entier : `respuestas.ts`, qui a changé dans la lecture du corps (6.8.1), et `laboratorio.ts`, dont le banc d'essai n'envoie plus de corps dans un `205` (une réponse `205` ne porte pas de contenu, RFC 9110, section 15.3.6 ; elle sort avec `Content-Length: 0` et sans `Transfer-Encoding`, parce que le `205` ne se délimite pas tout seul, RFC 9112, section 6.3). Aucune exécution de cette leçon ne demande de `205`. Ils figurent en entier pour que le `revisor` puisse être assemblé à partir de cette leçon :

```ts
// fig06_01/almacen.ts — los servicios que observa el revisor y las revisiones pedidas, en memoria.
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
// fig06_01/autenticacion.ts — quién eres (la credencial) y qué puedes hacer (el rol).
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
// fig06_01/destinos.ts — a dónde puede conectarse el revisor. Defensa contra SSRF.
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
// fig06_01/etiquetas.ts — leer y comparar etiquetas (ETag) como pide el RFC 9110.
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
// fig06_01/laboratorio.ts
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
// fig06_01/limitador.ts — cuántas veces se puede hacer algo en una ventana de tiempo.
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
// fig06_01/operacion.ts — el modo mantenimiento: lo enciende y lo apaga quien opera el revisor.
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
// fig06_01/respuestas.ts — las respuestas de éxito del revisor y la lectura del cuerpo. Los errores, en problemas.ts.
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
// fig06_01/rutas.ts — la puerta de la API: qué ruta existe, qué método admite y quién puede usarlo.
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
// fig06_01/servidor.ts — la cara servidor del revisor: la API que administra los servicios observados.
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
// fig06_01/versiones.ts — las versiones viejas de la API: /v1 está desaprobada y /v0 ya se retiró.
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

```json fig06_01/package.json
{
  "type": "module"
}
```

#### 6.8.3 L'exécution complète

Avec les trois programmes fraîchement démarrés dans `~/curso-http/fig06_01/`, voici les requêtes de la leçon dans l'ordre, rassemblées : la même clé deux fois, la même clé avec un autre corps, les deux à la fois, le client avec et sans clé à travers la passerelle, la liste, et une vérification de `pagos` :

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-68f9abf8"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 23:34:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-68f9abf8"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 23:34:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 228
Date: Wed, 21 Oct 2026 23:34:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/llave-reutilizada","title":"Esa Idempotency-Key ya se usó con otra petición","status":422,"detail":"la llave alta-avisos-1 ya se usó con un cuerpo distinto","instance":"/servicios"}

$ ( curl -o /dev/null -w 'primera: %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-correo-1' -d '{"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200"}' & sleep 0.1; curl -w '\nsegunda: %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-correo-1' -d '{"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200"}'; wait )
{"type":"https://revisor.example/problemas/llave-en-curso","title":"Esa Idempotency-Key sigue en curso","status":409,"detail":"la petición original con la llave alta-correo-1 todavía no termina","instance":"/servicios"}

segunda: 409
primera: 201

$ node alta-segura.ts agenda http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 201 {"id":9,"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
(código de salida: 0)

$ node alta-segura.ts nomina2 http://127.0.0.1:18081/codigo/200 --sin-llave; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento sin llave (podría duplicar)
intento 2: 409 {"type":"https://revisor.example/problemas/nombre-repetido","title":"Ya existe un servicio con ese nombre","status":409,"detail":"ya existe un servicio llamado nomina2","instance":"/servicios","existente":"/servicios/10"}
el servidor respondió 409: repetir lo mismo no lo arregla; sin llave no se sabe si lo que ya existe lo creó un intento anterior
(código de salida: 1)

$ curl http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a'
{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/lento/1500","limite_ms":2000},{"id":5,"nombre":"reportes","url":"http://127.0.0.1:18081/lento/3000","limite_ms":1000},{"id":6,"nombre":"facturacion","url":"http://127.0.0.1:18081/basura","limite_ms":2000},{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":8,"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":9,"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":10,"nombre":"nomina2","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ sleep 2
$ curl http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer escritura-a'
{"id":1,"servicio":2,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":503,"ms":17,"detalle":"503 (reintentar en 120 s)"}}
```

La vérification de `pagos` est celle de la Leçon 4, et maintenant avec une raison : elle est passée par `revisarConReintentos`, le service a demandé 120 s, et comme cela dépasse le plafond de 5 s, le `revisor` n'a pas insisté et a conservé l'avertissement dans le détail.

#### 6.8.4 Le reste continue de fonctionner

Les refus SSRF, les requêtes conditionnelles, la mise à jour perdue avec deux `PUT` simultanés, l'ordre du `PUT`, le schéma de l'identifiant, la méthode portant un nom de `Object.prototype`, le plafond du corps, le corps qui n'est pas un objet, les plages SSRF, la limite de requêtes en direct par identifiant, le `502` d'un service qui coupe la connexion, la lecture stricte de `Retry-After` et l'étiquette après redémarrage : rien de tout cela n'a changé. Voici la même exécution, à la suite. Presque à la fin, on arrête le `revisor` puis la passerelle (`$REV` et `$PAS` sont les PID qu'a enregistrés le script qui a démarré les programmes ; toi, tu les arrêterais avec `Ctrl+C`). `esperar_puerto` est une fonction de ce script : elle attend jusqu'à 10 s que le port accepte les connexions, au lieu de dormir un temps fixe après le démarrage d'un programme, pour répéter les cas de 6.5.3 (la passerelle qui répond `502` et `alta-segura.ts` avec les tentatives épuisées, avec et sans passerelle) ; on redémarre les deux, et entre l'avant-dernière et la dernière requête on redémarre le `revisor` une fois de plus :

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"metadatos","url":"http://169.254.169.254/latest/meta-data/"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 230
Date: Wed, 21 Oct 2026 23:34:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 169.254.169.254:80: dirección privada o reservada","instance":"/servicios"}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"yo-mismo","url":"http://localhost:18080/mantenimiento"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 235
Date: Wed, 21 Oct 2026 23:34:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: localhost resuelve a una dirección privada o reservada","instance":"/servicios"}

$ ETAG=$(curl -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'); echo "ETAG=$ETAG"
ETAG="1-1-68f9abf8"

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H "If-None-Match: W/$ETAG"
HTTP/1.1 304 Not Modified
ETag: "1-1-68f9abf8"
Date: Wed, 21 Oct 2026 23:34:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5


$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H "If-None-Match: \"9-9\", $ETAG"
HTTP/1.1 304 Not Modified
ETag: "1-1-68f9abf8"
Date: Wed, 21 Oct 2026 23:34:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5


$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H 'If-None-Match: *'
HTTP/1.1 304 Not Modified
ETag: "1-1-68f9abf8"
Date: Wed, 21 Oct 2026 23:34:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5


$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H 'If-None-Match: "9-9", W/"8-8"'
HTTP/1.1 200 OK
ETag: "1-1-68f9abf8"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 23:34:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: W/$ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 412 Precondition Failed
Content-Type: application/problem+json
Content-Language: es
Content-Length: 263
Date: Wed, 21 Oct 2026 23:34:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/etiqueta-vencida","title":"Tu etiqueta ya no es la vigente","status":412,"detail":"If-Match se compara en fuerte: una etiqueta débil (W/) no sirve para cambiar; manda la ETag tal como llegó","instance":"/servicios/1"}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: \"9-9\", $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-2-68f9abf8"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 23:34:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: *' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-3-68f9abf8"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 23:34:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ ETAG=$(curl -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ETAG=$ETAG"
ETAG="1-3-68f9abf8"

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
ID=/servicios/11 ETAG="11-1-68f9abf8"

$ ( sleep 1; printf '%s' '{"nombre":"efimero","url":"http://127.0.0.1:18081/codigo/200"}' ) | curl -w ' <- PUT lento: %{http_code}\n' -X PUT -T - http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" & LENTO=$!; sleep 0.3; curl -o /dev/null -w 'DELETE en el hueco: %{http_code}\n' -X DELETE http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a'; wait $LENTO
DELETE en el hueco: 204
{"type":"https://revisor.example/problemas/servicio-retirado","title":"El servicio se retiró","status":410,"detail":"el servicio 11 se retiró y no va a volver","instance":"/servicios/11"}
 <- PUT lento: 410

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 800
Date: Wed, 21 Oct 2026 23:34:46 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/lento/1500","limite_ms":2000},{"id":5,"nombre":"reportes","url":"http://127.0.0.1:18081/lento/3000","limite_ms":1000},{"id":6,"nombre":"facturacion","url":"http://127.0.0.1:18081/basura","limite_ms":2000},{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":8,"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":9,"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":10,"nombre":"nomina2","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Basic bGVjdHVyYS1hOg=='
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: application/problem+json
Content-Language: es
Content-Length: 185
Date: Wed, 21 Oct 2026 23:34:46 GMT
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
Date: Wed, 21 Oct 2026 23:34:46 GMT

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
Date: Wed, 21 Oct 2026 23:34:46 GMT
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
ID=/servicios/12

$ curl -i http://127.0.0.1:18080$ID/salud -H 'Authorization: Bearer admin'
HTTP/1.1 502 Bad Gateway
Content-Type: application/problem+json
Content-Language: es
Content-Length: 280
Date: Wed, 21 Oct 2026 23:34:47 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/respuesta-invalida","title":"El servicio no dio una respuesta HTTP válida","status":502,"detail":"el servicio 12 no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP","instance":"/servicios/12/salud"}

$ TZ=America/Mexico_City node --input-type=module -e 'import { segundosDeEspera } from "./cliente.ts"; for (const v of ["120", "1.5", "-1", "12 30"]) console.log(JSON.stringify(v), "->", segundosDeEspera(v)); const imf = segundosDeEspera("Fri, 01 Jan 2100 00:00:00 GMT"), asc = segundosDeEspera("Fri Jan  1 00:00:00 2100"); console.log("asctime menos IMF-fixdate (misma fecha):", asc - imf, "s")'
"120" -> 120
"1.5" -> null
"-1" -> null
"12 30" -> null
asctime menos IMF-fixdate (misma fecha): 0 s

$ kill $REV; wait $REV 2>/dev/null

$ curl -i -X POST http://127.0.0.1:18082/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"sin-revisor","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 502 Bad Gateway
Content-Type: application/problem+json
Content-Length: 115
Date: Wed, 21 Oct 2026 23:34:47 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}

$ node alta-segura.ts sin-revisor http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
  espero entre 0 y 1000 ms y reintento con la misma llave
intento 3: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
  espero entre 0 y 2000 ms y reintento con la misma llave
intento 4: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
se agotaron los 4 intentos sin una respuesta definitiva; repetir más tarde con la llave 482212c7-c00e-499c-b66e-50f774613a5b es seguro
(código de salida: 1)

$ kill $PAS; wait $PAS 2>/dev/null

$ node alta-segura.ts sin-pasarela http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: sin respuesta (ECONNREFUSED)
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: sin respuesta (ECONNREFUSED)
  espero entre 0 y 1000 ms y reintento con la misma llave
intento 3: sin respuesta (ECONNREFUSED)
  espero entre 0 y 2000 ms y reintento con la misma llave
intento 4: sin respuesta (ECONNREFUSED)
se agotaron los 4 intentos sin una respuesta definitiva; repetir más tarde con la llave bb5d6748-d1cc-4a88-b665-48721b90a18c es seguro
(código de salida: 1)

$ node -e 'require("node:net").createServer(() => {}).listen(18082, "127.0.0.1")' & MUDO=$!; esperar_puerto 18082

$ ALTA_LIMITE_MS=300 node alta-segura.ts mudo http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: sin respuesta (tiempo agotado: 300 ms)
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: sin respuesta (tiempo agotado: 300 ms)
  espero entre 0 y 1000 ms y reintento con la misma llave
intento 3: sin respuesta (tiempo agotado: 300 ms)
  espero entre 0 y 2000 ms y reintento con la misma llave
intento 4: sin respuesta (tiempo agotado: 300 ms)
se agotaron los 4 intentos sin una respuesta definitiva; repetir más tarde con la llave 2d5d719b-8c6b-49a0-b118-494720b1831c es seguro
(código de salida: 1)

$ kill $MUDO; wait $MUDO 2>/dev/null

$ node --input-type=module -e 'import { createServer } from "node:http"; let n = 0; createServer((q, r) => { q.resume(); if (++n === 1) { r.writeHead(503, { "Retry-After": "2", "Content-Type": "application/problem+json" }); r.end("{\"type\":\"about:blank\",\"title\":\"Service Unavailable\",\"status\":503}\n"); } else { r.writeHead(201, { "Content-Type": "application/json" }); r.end("{\"id\":99}\n"); } }).listen(18082, "127.0.0.1")' & PIDE=$!; esperar_puerto 18082

$ node alta-segura.ts paciente http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 503 {"type":"about:blank","title":"Service Unavailable","status":503}
  el servidor pide esperar 2 s (Retry-After); espero 2 s y reintento con la misma llave
intento 2: 201 {"id":99}
(código de salida: 0)

$ kill $PIDE; wait $PIDE 2>/dev/null

$ node --input-type=module -e 'import { createServer } from "node:http"; let n = 0; createServer((q, r) => { q.resume(); if (++n === 1) { r.writeHead(409, { "Content-Type": "application/problem+json" }); r.end("{\"type\":\"https://revisor.example/problemas/llave-en-curso\",\"title\":\"Esa Idempotency-Key sigue en curso\",\"status\":409}\n"); } else { r.writeHead(201, { "Content-Type": "application/json" }); r.end("{\"id\":99}\n"); } }).listen(18082, "127.0.0.1")' & CURSO=$!; esperar_puerto 18082

$ node alta-segura.ts en-curso http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 409 {"type":"https://revisor.example/problemas/llave-en-curso","title":"Esa Idempotency-Key sigue en curso","status":409}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 201 {"id":99}
(código de salida: 0)

$ kill $CURSO; wait $CURSO 2>/dev/null

$ node pasarela.ts >> pasarela.log 2>&1 & PAS=$!; node servidor.ts >> servidor.log 2>&1 & REV=$!; esperar_puerto 18082; esperar_puerto 18080

$ curl -i -X POST http://127.0.0.1:18082/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"por-pasarela","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
content-type: application/json
content-length: 92
location: /servicios/7
etag: "7-1-7b8bb8f3"
Date: Wed, 21 Oct 2026 23:34:56 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"por-pasarela","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ node alta-segura.ts invalida ftp://archivos; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 422 {"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"1 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser una dirección http o https","pointer":"#/url"}]}
el servidor respondió 422: repetir lo mismo no lo arregla
(código de salida: 1)

$ curl -o /dev/null -w '%{http_code}\n' -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":true}'
204

$ node alta-segura.ts enmantenimiento http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 503 {"type":"https://revisor.example/problemas/en-mantenimiento","title":"El revisor está en mantenimiento","status":503,"detail":"el revisor está en mantenimiento","instance":"/servicios"}
el servidor pidió esperar 120 s (Retry-After), más de los 5 s que este programa espera; no se reintenta; repetir más tarde con la llave ffdfd2cf-5288-4266-8637-68d792db78f5 es seguro
(código de salida: 1)

$ curl -o /dev/null -w '%{http_code}\n' -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":false}'
204

$ ANTES=$(curl -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b'); echo "ANTES=$ANTES"
ANTES="3-1-7b8bb8f3"

$ kill $REV; wait $REV 2>/dev/null; node servidor.ts >> servidor.log 2>&1 & REV=$!; esperar_puerto 18080

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b' -H "If-None-Match: $ANTES"
HTTP/1.1 200 OK
ETag: "3-1-223a2357"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 23:34:57 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

Et les deux terminaux de l'exécution complète. Celui du `revisor` consigne la méthode et la route de chaque requête, les deux lignes d'idempotence et les deux démarrages qui suivent le premier (un pour chaque redémarrage, que tu vois comme un deuxième et un troisième « revisor en… ») ; celui de la passerelle, les deux réponses qu'elle a perdues, les cinq « el revisor no respondió » (le `curl` et les quatre tentatives de `sin-revisor`) et son deuxième démarrage :

```text
--- terminal del revisor (la carpeta de la máquina se escribe <carpeta>):
revisor en http://127.0.0.1:18080
POST /servicios
POST /servicios
idempotencia: la llave alta-avisos-1 ya se atendió; repito su respuesta
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
idempotencia: la llave 00baad42-25bb-4f27-adbd-fa28abaf50fb ya se atendió; repito su respuesta
POST /servicios
POST /servicios
GET /servicios
POST /servicios/2/revisiones
GET /revisiones/1
POST /servicios
POST /servicios
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
GET /servicios/11
PUT /servicios/11
DELETE /servicios/11
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
GET /servicios/12/salud
revisor en http://127.0.0.1:18080
POST /servicios
POST /servicios
POST /servicios
PUT /mantenimiento
operación: mantenimiento encendido
POST /servicios
POST /servicios
PUT /mantenimiento
operación: mantenimiento apagado
GET /servicios/3
revisor en http://127.0.0.1:18080
GET /servicios/3
--- terminal de la pasarela:
pasarela en http://127.0.0.1:18082 → http://127.0.0.1:18080
pasarela: el revisor respondió 201, pero la respuesta se pierde
pasarela: el revisor respondió 201, pero la respuesta se pierde
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela en http://127.0.0.1:18082 → http://127.0.0.1:18080
pasarela: el revisor respondió 422, pero la respuesta se pierde
pasarela: el revisor respondió 503, pero la respuesta se pierde
```

### 6.9 Le vérifier avec un programme

Comme dans la Leçon 5, ce qui peut se vérifier à la main se vérifie avec un programme. `fig06_03.ts` effectue cinq essais contre l'enregistrement, chacun avec de nouveaux noms et de nouvelles clés, pour qu'on puisse l'exécuter autant de fois qu'on veut sans redémarrer le `revisor` : la même clé deux fois laisse un seul service ; la même clé avec un autre corps donne `422` `llave-reutilizada` et ne crée rien ; la même clé alors que l'originale est toujours en cours donne `409` `llave-en-curso` ; un enregistrement qui échoue libère la clé ; et deux clés distinctes avec le même corps se heurtent au nom. Ce dernier ne met pas la clé à l'épreuve, il met à l'épreuve sa frontière : la clé ne transforme pas deux intentions en une seule.

```ts
// fig06_03.ts — comprueba que el alta del revisor respete Idempotency-Key como propone el borrador de la IETF.
// Uso: node fig06_03.ts [base]     (por omisión, http://127.0.0.1:18080)
// Cada corrida usa nombres y llaves nuevos, así que se puede repetir sin reiniciar el revisor.
import { randomUUID } from "node:crypto";

const BASE = process.argv[2] ?? "http://127.0.0.1:18080";
const URL_LAB = "http://127.0.0.1:18081/codigo/200";
const PROBLEMAS = "https://revisor.example/problemas/";
const marca = randomUUID().slice(0, 8);

type Respuesta = { codigo: number; location: string | null; cuerpo: Record<string, unknown> };

async function alta(llave: string, datos: Record<string, unknown>): Promise<Respuesta> {
  const respuesta = await fetch(BASE + "/servicios", {
    method: "POST",
    headers: { Authorization: "Bearer escritura-a", "Content-Type": "application/json", "Idempotency-Key": llave },
    body: JSON.stringify(datos),
  });
  return { codigo: respuesta.status, location: respuesta.headers.get("location"), cuerpo: await respuesta.json() };
}

async function cuantos(nombre: string): Promise<number> {
  const respuesta = await fetch(BASE + "/servicios", { headers: { Authorization: "Bearer escritura-a" } });
  const { servicios } = (await respuesta.json()) as { servicios: { nombre: string }[] };
  return servicios.filter((s) => s.nombre === nombre).length;
}

type Caso = { nombre: string; probar: () => Promise<string | null> };

const CASOS: Caso[] = [
  {
    nombre: "misma llave y mismo cuerpo: la misma respuesta, un solo servicio",
    probar: async () => {
      const datos = { nombre: `uno-${marca}`, url: URL_LAB };
      const primera = await alta(`k1-${marca}`, datos);
      const segunda = await alta(`k1-${marca}`, datos);
      if (primera.codigo !== 201) return `la primera dio ${primera.codigo}, se esperaba 201`;
      if (segunda.codigo !== 201 || segunda.location !== primera.location) {
        return `la segunda dio ${segunda.codigo} ${segunda.location}, se esperaba 201 ${primera.location}`;
      }
      const n = await cuantos(datos.nombre);
      return n === 1 ? null : `hay ${n} servicios con ese nombre, se esperaba 1`;
    },
  },
  {
    nombre: "misma llave con otro cuerpo: 422 llave-reutilizada, y no crea nada",
    probar: async () => {
      await alta(`k2-${marca}`, { nombre: `dos-${marca}`, url: URL_LAB });
      const otra = await alta(`k2-${marca}`, { nombre: `otro-${marca}`, url: URL_LAB });
      if (otra.codigo !== 422 || otra.cuerpo.type !== PROBLEMAS + "llave-reutilizada") {
        return `dio ${otra.codigo} ${String(otra.cuerpo.type ?? "")}, se esperaba 422 llave-reutilizada`;
      }
      const n = await cuantos(`otro-${marca}`);
      return n === 0 ? null : `se creó el servicio del segundo cuerpo (${n})`;
    },
  },
  {
    nombre: "misma llave mientras la original sigue en curso: 409 llave-en-curso",
    probar: async () => {
      const datos = { nombre: `tres-${marca}`, url: URL_LAB };
      const original = alta(`k3-${marca}`, datos);
      await new Promise((listo) => setTimeout(listo, 100));
      const durante = await alta(`k3-${marca}`, datos);
      const primera = await original;
      if (durante.codigo !== 409 || durante.cuerpo.type !== PROBLEMAS + "llave-en-curso") {
        return `la de en medio dio ${durante.codigo} ${String(durante.cuerpo.type ?? "")}, se esperaba 409 llave-en-curso`;
      }
      return primera.codigo === 201 ? null : `la original dio ${primera.codigo}, se esperaba 201`;
    },
  },
  {
    nombre: "un alta que falla libera la llave: corregida, con la misma llave, 201",
    probar: async () => {
      const mala = await alta(`k4-${marca}`, { nombre: `cuatro-${marca}`, url: "ftp://archivos" });
      if (mala.codigo !== 422) return `el alta mala dio ${mala.codigo}, se esperaba 422`;
      const buena = await alta(`k4-${marca}`, { nombre: `cuatro-${marca}`, url: URL_LAB });
      return buena.codigo === 201 ? null : `el alta corregida dio ${buena.codigo}, se esperaba 201`;
    },
  },
  {
    nombre: "dos llaves distintas con el mismo cuerpo: la segunda choca con el nombre (409 nombre-repetido)",
    probar: async () => {
      const datos = { nombre: `cinco-${marca}`, url: URL_LAB };
      await alta(`k5a-${marca}`, datos);
      const otra = await alta(`k5b-${marca}`, datos);
      if (otra.codigo !== 409 || otra.cuerpo.type !== PROBLEMAS + "nombre-repetido") {
        return `dio ${otra.codigo} ${String(otra.cuerpo.type ?? "")}, se esperaba 409 nombre-repetido`;
      }
      const n = await cuantos(datos.nombre);
      return n === 1 ? null : `hay ${n} servicios con ese nombre, se esperaba 1`;
    },
  },
];

let bien = 0;
for (const caso of CASOS) {
  const falla = await caso.probar();
  if (falla === null) bien++;
  console.log(`${falla === null ? "ok   " : "FALLA"} ${caso.nombre}`);
  if (falla !== null) console.log(`      ${falla}`);
}
console.log();
console.log(`${bien} de ${CASOS.length} comprobaciones de idempotencia pasaron`);
process.exitCode = bien === CASOS.length ? 0 : 1;
```

```text
$ node fig06_03.ts
ok    misma llave y mismo cuerpo: la misma respuesta, un solo servicio
ok    misma llave con otro cuerpo: 422 llave-reutilizada, y no crea nada
ok    misma llave mientras la original sigue en curso: 409 llave-en-curso
ok    un alta que falla libera la llave: corregida, con la misma llave, 201
ok    dos llaves distintas con el mismo cuerpo: la segunda choca con el nombre (409 nombre-repetido)

5 de 5 comprobaciones de idempotencia pasaron
```

Cinq sur cinq, et le programme sort avec le code 0 (ou 1 si quelque chose échoue), si bien qu'on peut l'utiliser dans un script. C'est une autre pièce de la matrice de la Leçon 8, qui vérifie la même chose avec les 23 codes.

### 6.10 Vérifier les types avec `tsc` (facultatif)

Depuis le dossier du `revisor`, avec la commande de la section 0.9 de la Leçon 0 plus `--allowImportingTsExtensions` :

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

Il n'affiche rien : il n'y a pas d'erreurs. `fig06_02.ts`, `fig06_03.ts` et `fig06_04.ts` passent la même commande depuis le dossier du dessus, de même que les deux versions cassées de la section suivante et la solution de l'exercice 3, chacune posée sur une copie du `revisor`.

## L'erreur que tu vas voir

### La clé qui change à chaque tentative

L'erreur la plus courante avec `Idempotency-Key` est de générer la clé au mauvais endroit : dans la boucle de nouvelles tentatives, à côté de la requête, au lieu de l'extérieur, à côté de l'intention. Cela paraît naturel, parce que « chaque requête porte sa clé ». Pour la provoquer, copie `fig06_01/` sous le nom `rota/` et fais en sorte que `rota/alta-segura.ts` invente de nouveau la clé à chaque tour du `for` (la version complète est dans `defectos/llave-por-intento/alta-segura.ts`). La clé passe de `const` à `let`, et elle est réaffectée au début de chaque tentative :

```ts
// DEFECTO A PROPÓSITO (lección 6): la llave se vuelve a inventar en cada intento, no una por intención.
let llave = opcion === "--sin-llave" ? undefined : randomUUID();
```

```ts
for (let intento = 1; intento <= INTENTOS && !terminado; intento++) {
  llave = opcion === "--sin-llave" ? undefined : randomUUID();
  const resultado = await intentar();
```

Démarre le laboratoire, le `revisor` et la passerelle depuis `rota/` et enregistre `agenda` :

```text
$ node alta-segura.ts agenda http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 1000 ms y reintento con la misma llave
intento 3: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 2000 ms y reintento con la misma llave
intento 4: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
se agotaron los 4 intentos sin una respuesta definitiva; repetir más tarde con la llave 27448039-e4ad-4701-8fd0-597a17c28f2a es seguro
(código de salida: 1)

$ curl http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a'
{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/lento/1500","limite_ms":2000},{"id":5,"nombre":"reportes","url":"http://127.0.0.1:18081/lento/3000","limite_ms":1000},{"id":6,"nombre":"facturacion","url":"http://127.0.0.1:18081/basura","limite_ms":2000},{"id":7,"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}

--- terminal del revisor:
revisor en http://127.0.0.1:18080
POST /servicios
POST /servicios
POST /servicios
POST /servicios
GET /servicios

--- terminal de la pasarela:
pasarela en http://127.0.0.1:18082 → http://127.0.0.1:18080
pasarela: el revisor respondió 201, pero la respuesta se pierde
pasarela: el revisor respondió 409, pero la respuesta se pierde
pasarela: el revisor respondió 409, pero la respuesta se pierde
pasarela: el revisor respondió 409, pero la respuesta se pierde
```

Quatre `502`, et le client abandonne, convaincu que cela a échoué. La liste dit autre chose : `agenda` existe, avec l'id 7. Et les terminaux racontent l'histoire : le `revisor` a reçu quatre enregistrements ; le premier a créé `agenda` et les trois autres se sont heurtés au nom (`409`) ; la passerelle a jeté les quatre réponses. Pourquoi les quatre, si la passerelle ne perd que la première réponse de chaque requête ? Parce qu'elle reconnaît « la même requête » à sa clé, et que chaque tentative en portait une nouvelle : pour elle, ce furent quatre requêtes distinctes, chacune à sa première fois. Pour le `revisor` aussi : aucune clé ne s'est répétée, si bien qu'il n'y a jamais rien eu à répéter. **Une clé par tentative revient à ne pas avoir de clé**, avec une circonstance aggravante : le code paraît protégé.

Remarque aussi ce que le programme dit de lui-même. Chaque attente annonce « reintento con la misma llave », et c'est faux : le texte a été construit au début, quand il n'y avait encore qu'une seule clé. Et la dernière ligne, « repetir más tarde con la llave … es seguro », nomme la clé de la quatrième tentative, qui n'est pas celle qui a créé `agenda` (c'était celle de la première, et le `revisor` ne l'a pas revue). Celui qui suit ce conseil n'est protégé contre rien. Avec une clé par tentative, les messages vrais de la version correcte deviennent des mensonges que personne ne remarque, parce que la sortie semble soignée : la sortie d'un programme n'est fiable que dans la mesure où l'est la logique qui la produit, et ici le code et le texte se contredisent.

Ici, le filet du nom a sauvé le `revisor` du doublon. Un `POST` sans champ unique, comme demander une vérification, en aurait créé quatre. Arrête les programmes de `rota/` quand tu as terminé.

### L'empreinte que personne ne compare

La deuxième erreur est côté serveur : enregistrer la clé et oublier l'empreinte. C'est tentant, parce que « si la clé est unique, le corps doit être le même ». Copie de nouveau `fig06_01/` sous le nom `rota2/` et supprime dans `rota2/idempotencia.ts` la comparaison de l'empreinte (la version complète est dans `defectos/sin-huella/idempotencia.ts`) :

```ts
  // DEFECTO A PROPÓSITO (lección 6): no se compara la huella; cualquier cuerpo con esa llave «es el mismo».
```

Démarre les trois depuis `rota2/` et envoie les deux enregistrements de 6.6.4, celui d'`avisos` et celui de `correo` avec la même clé :

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-9d9d764a"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 22:26:02 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-9d9d764a"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 22:26:02 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a'
{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/lento/1500","limite_ms":2000},{"id":5,"nombre":"reportes","url":"http://127.0.0.1:18081/lento/3000","limite_ms":1000},{"id":6,"nombre":"facturacion","url":"http://127.0.0.1:18081/basura","limite_ms":2000},{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}
```

L'enregistrement de `correo` a reçu `201 Created` avec le corps d'`avisos`. Un client qui ne regarde que le code croit que `correo` existe, et la liste dit que non. C'est pire qu'une erreur, parce qu'on ne la voit pas : la défaillance apparaît des jours plus tard, quand quelqu'un cherche `correo` dans le tableau. Le vérificateur la trouve :

```text
$ node fig06_03.ts
ok    misma llave y mismo cuerpo: la misma respuesta, un solo servicio
FALLA misma llave con otro cuerpo: 422 llave-reutilizada, y no crea nada
      dio 201 , se esperaba 422 llave-reutilizada
ok    misma llave mientras la original sigue en curso: 409 llave-en-curso
ok    un alta que falla libera la llave: corregida, con la misma llave, 201
ok    dos llaves distintas con el mismo cuerpo: la segunda choca con el nombre (409 nombre-repetido)

4 de 5 comprobaciones de idempotencia pasaron
```

Quatre sur cinq : le seul essai qui échoue est celui qui envoie un autre corps avec la même clé. Le correctif est celui de `fig06_01/` : comparer l'empreinte et répondre `422` quand elle ne coïncide pas. Arrête les programmes de `rota2/` quand tu as terminé.

## Ce qui se fait de travers

**Tout réessayer.** Un `400`, un `401`, un `404` ou un `422` ne s'améliorent pas avec le temps : les répéter ne fait que gaspiller. Les deux questions de 6.3.1 passent avant toute nouvelle tentative.

**Réessayer sans attendre, ou en attendant toujours la même chose.** Sans attente, la nouvelle tentative arrive alors que le serveur est toujours en panne. Avec une attente fixe et sans hasard, tous les clients arrivent ensemble. Un backoff exponentiel avec *jitter*, avec un plafond et un nombre maximal de tentatives.

**Fermer d'un coup après le `413`.** Si le serveur ferme la connexion pendant que le client continue d'envoyer, le `RST` peut effacer le `413` et le client voit une erreur réseau au lieu de la réponse. On ferme par étapes : on répond, on ferme l'écriture, on continue de lire un moment, puis on ferme complètement (RFC 9112, section 9.6).

**Attendre sans limite.** Un `fetch` sans délai maximal laisse un client suspendu pendant des minutes face à un serveur qui accepte la connexion et ne répond pas. Chaque tentative porte une limite et, si elle est interrompue, on la traite comme « sans réponse ».

**Sortir avec succès quand il n'y en a pas eu.** Un programme qui se termine avec `0` après un `422` ou un `409` dit à celui qui l'appelle que l'enregistrement a eu lieu. Le `0` est réservé à un enregistrement qui a eu lieu.

**Attendre après la dernière tentative.** Le temps est gaspillé pour rien, et le client met plus longtemps à apprendre que cela a échoué. Et terminer sans dire que les tentatives sont épuisées (ou terminer avec succès) laisse le script qui l'appelle sans savoir ce qui reste en suspens : une fois les tentatives épuisées, un message et un code de sortie différent de zéro.

**Réessayer à chaque couche.** Si le navigateur, la passerelle, le service et la bibliothèque de la base de données réessaient chacun trois fois, une défaillance se multiplie par des dizaines. On réessaie à un seul endroit.

**Ignorer `Retry-After`, ou le prendre pour une suggestion.** Si le serveur demande 120 s et que le client réessaie au bout de 2, le `429` suivant est mérité. Si l'attente qu'il demande est plus longue que ce que le client peut attendre, le plus honnête est de ne pas réessayer et de le dire, comme le fait le `revisor`.

**Réessayer un `POST` sans clé.** C'est la scène d'ouverture. Si le serveur n'offre pas de clé, le client réconcilie (relit l'état) avant de répéter.

**Générer la clé à chaque tentative.** C'est « La clé qui change à chaque tentative » : le code paraît protégé et ne l'est pas.

**Enregistrer la clé sans l'empreinte.** C'est « L'empreinte que personne ne compare » : un corps différent reçoit un succès qui n'est pas le sien.

**Enregistrer la clé sans l'identifiant.** La table des clés devient un cache que n'importe qui peut lire en devinant des clés (6.7.5).

**Promettre « sans doublons » sans dire jusqu'à quand.** Une clé expire, se perd lors d'un redémarrage si elle vit ailleurs que ce qu'elle protège, ne couvre pas les effets externes et ne couvre pas les autres routes. Si la documentation de ton API ne dit pas cela, tes clients vont supposer que la clé protège plus qu'elle ne protège.

**Présenter `Idempotency-Key` comme un standard.** C'est un brouillon expiré. Utilise-la, et écris-la dans ta documentation pour ce qu'elle est.

## Exercices

Les quatre se corrigent tout seuls : chacun se termine par une exécution qui te dit si tu as juste. Écris ta prédiction dans le [journal de bord](bitacora.md) **avant** d'exécuter quoi que ce soit. Pour le 1 et le 4, il te faut le laboratoire, le `revisor` et la passerelle de 6.8 fraîchement démarrés.

### Exercice 1 — Peut-on le répéter ?

Pour chacune de ces six opérations, prédis si elle est idempotente et ce qu'elle répond la deuxième fois. Exécute ensuite chacune **deux fois**, et compare l'état avec celui que tu attendais :

1. `GET /servicios/1`
2. `PUT /servicios/1` avec `If-Match: *` et `{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}`
3. `PUT /mantenimiento` avec `admin` et `{"activo":false}`
4. `POST /servicios/1/revisiones`
5. `DELETE /servicios/1`
6. `POST /servicios` avec `Idempotency-Key: ejercicio-1` et `{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}`

Indice : pour chacune, affiche le code et, le cas échéant, l'`ETag` ou le `Location` avec `curl -o /dev/null -w '%{http_code} %header{etag}\n'`.

### Exercice 2 — Les attentes d'`alta-segura.ts`

Sans rien exécuter, réponds : si les quatre tentatives d'`alta-segura.ts` reçoivent `502`, combien de fois attend-il ? Quel est le plafond de chaque attente ? Combien de temps peut-il mettre, au maximum, à abandonner (sans compter le temps que prennent les requêtes) ? Qu'affiche-t-il à la fin et avec quel code sort-il ? Prédis aussi ce qui change si l'enregistrement se fait avec `--sin-llave`. Compare ensuite avec les exécutions de 6.5.3. Enfin, dis en une phrase pourquoi `if (intento === INTENTOS) break;` se place **avant** l'attente et non après. Pour finir, prédis le code de sortie et le nombre de requêtes que voit `fig06_04.ts` avec chacune de ces trois réponses et vérifie avec 6.5.4 : `422`, `503:1 201` et `409:en-curso 201`.

### Exercice 3 — La clé qui expire

Copie `fig06_01/` sous le nom `ej3/` et ajoute à `ej3/idempotencia.ts` une durée de validité : enregistre dans chaque entrée le moment où la clé a été mise de côté, et si plus de `VIGENCIA_MS` millisecondes se sont écoulées, traite la clé comme nouvelle. Utilise 5 000 ms par défaut, pour pouvoir la voir expirer, et permets de la modifier au démarrage avec la variable d'environnement `REVISOR_VIGENCIA_MS`.

Pour savoir si tu as juste, démarre les trois programmes depuis `ej3/` et fais deux expériences. D'abord, envoie l'enregistrement d'`avisos` avec `Idempotency-Key: vence-1` deux fois de suite, attends six secondes et envoie-le une troisième fois : prédis le code de chacun. Ensuite, enregistre `agenda` avec `Idempotency-Key: vence-2`, retire-le, attends six secondes et répète l'enregistrement avec la même clé : prédis le code et l'id.

### Exercice 4 — Combien de fois appelle-t-il ?

Enregistre trois services du laboratoire, `e-504` (`/codigo/504`), `e-cortar` (`/cortar`) et `e-500` (`/codigo/500`), et demande une vérification de chacun avec `escritura-a`, plus une de `reportes` (le service 5, `/lento/3000` avec une limite de 1 000 ms) avec `admin`. Avant de regarder le terminal du laboratoire, prédis combien de fois apparaît chaque route et quel `detalle` a chaque vérification. Attends huit secondes avant de demander les résultats : pourquoi autant ?

## Solutions

### Solution 1

```text
$ for i in 1 2; do curl -o /dev/null -w 'GET: %{http_code} %header{etag}\n' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'; done
GET: 200 "1-1-7552bbf0"
GET: 200 "1-1-7552bbf0"

$ for i in 1 2; do curl -o /dev/null -w 'PUT con *: %{http_code} %header{etag}\n' -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: *' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'; done
PUT con *: 200 "1-2-7552bbf0"
PUT con *: 200 "1-3-7552bbf0"

$ curl http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ for i in 1 2; do curl -o /dev/null -w 'PUT /mantenimiento: %{http_code}\n' -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":false}'; done
PUT /mantenimiento: 204
PUT /mantenimiento: 204

$ for i in 1 2; do curl -o /dev/null -w 'POST revisión: %{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios/1/revisiones -H 'Authorization: Bearer escritura-a'; done
POST revisión: 202 /revisiones/1
POST revisión: 202 /revisiones/2

$ for i in 1 2; do curl -o /dev/null -w 'DELETE: %{http_code}\n' -X DELETE http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'; done
DELETE: 204
DELETE: 410

$ for i in 1 2; do curl -o /dev/null -w 'POST con llave: %{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: ejercicio-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'; done
POST con llave: 201 /servicios/7
POST con llave: 201 /servicios/7
```

1. **`GET`** : sûr et idempotent. `200` les deux fois, le même `ETag` : rien n'a changé.
2. **`PUT` avec `*`** : idempotent. `200` les deux fois, et le contenu reste le même (`"limite_ms":1500`), mais l'`ETag` est passé de `"1-2-…"` à `"1-3-…"` : le `revisor` incrémente la version à chaque écriture. C'est ce que dit 6.2.3 : l'effet demandé est le même, et le serveur peut tenir son propre historique.
3. **`PUT /mantenimiento`** : idempotent. `204` les deux fois ; le mode reste désactivé.
4. **`POST` de vérification** : **non** idempotent. Deux vérifications, `/revisiones/1` et `/revisiones/2`.
5. **`DELETE`** : idempotent. `204` et `410` ; le service reste retiré dans les deux cas.
6. **`POST` avec clé** : la méthode n'est pas idempotente, mais la clé fait que répéter cette requête a le même effet que la faire une seule fois, tant que la clé reste valide. `201` les deux fois, le même `Location`.

Si tu t'es trompé sur le 2, c'est le piège le plus courant : une réponse identique ne prouve rien, et un `ETag` différent ne rompt pas l'idempotence.

### Solution 2

Il attend **trois fois**, pas quatre : entre une tentative et la suivante il y a trois intervalles, et après la quatrième il ne reste rien à attendre. Les plafonds sont `250 × 2^n` avec un plafond de 2 000, pour `n` égal à 1, 2 et 3 : 500, 1 000 et 2 000 ms. Au maximum, il met 3,5 secondes à abandonner, en additionnant les plafonds ; avec la limite de 2 000 ms par requête, 11,5 secondes au total.

À la fin, il affiche « se agotaron los 4 intentos sin una respuesta definitiva » et sort avec le code `1`. Avec une clé, il ajoute « repetir más tarde con la llave … es seguro » ; avec `--sin-llave`, en revanche, « no se sabe si el alta ocurrió », parce que sans clé il n'y a pas de nouvelle tentative qu'on puisse offrir comme sûre. Et les attentes changent de texte, de « con la misma llave » à « sin llave (podría duplicar) », mais pas de durée : le *jitter* ne dépend pas de la clé. Les deux sorties se trouvent dans `agotados.salida.txt`, qui est celle que montre 6.5.3.

La ligne se place avant l'attente parce que celui qui décide de dormir doit savoir s'il y a quelque chose pour quoi se réveiller. Si elle venait après, le programme dormirait jusqu'à 2 000 ms de plus pour découvrir qu'il n'y a plus de tentatives, et un script avec quatorze enregistrements en échec perdrait ainsi jusqu'à 28 secondes. `revisarConReintentos` résout la même chose autrement : son attente se trouve dans le corps du `for`, avant la requête suivante, et ce corps ne s'exécute pas lorsque `intento < INTENTOS` cesse d'être vrai.

Les trois réponses de la fin, avec le serveur simulé : un `422` est un `4xx` que répéter ne règle pas, donc **une** requête et le code `1`. `503:1 201` demande d'attendre une seconde (moins que le plafond de 5 s) : **deux** requêtes, la seconde une seconde plus tard, et le code `0`. `409:en-curso 201` est un `409` qui, lui, est réessayé, avec une attente tirée au sort : **deux** requêtes et le code `0`. Si tu as répondu que le `422` est réessayé ou que le `409:en-curso` est définitif, relis la table de 6.3.2 et le `type` du `409`.

### Solution 3

La version complète se trouve dans `ejercicios/ej3/idempotencia.ts` :

```ts
// ejercicios/ej3/idempotencia.ts — solución del ejercicio 3: Idempotency-Key con una vigencia publicada.
// OJO: Idempotency-Key NO es un estándar. Es un borrador de la IETF
// (draft-ietf-httpapi-idempotency-key-header-07, que venció el 18 de abril de 2026 sin publicarse
// como RFC). El revisor lo usa como un patrón que su API documenta, con los códigos que propone
// el borrador: 422 si la llave se reutiliza con otra petición, 409 si la original sigue en curso.
import { createHash } from "node:crypto";

export type Grabada = { codigo: number; cabeceras: Record<string, string>; cuerpo: unknown };

type Registro = { huella: string; grabada: Grabada | null; desde: number };

// Por credencial y llave. Una API real las guarda en su base y las borra tras un plazo (p. ej. 24 h).
const registros = new Map<string, Registro>();

// Cuánto vive una llave después de su primer uso. Corta a propósito, para verla vencer en el ejercicio;
// se puede cambiar al arrancar: REVISOR_VIGENCIA_MS=86400000 node servidor.ts (24 horas).
const VIGENCIA_MS = Number(process.env.REVISOR_VIGENCIA_MS ?? 5000);

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
  // Una llave vencida se olvida: la petición se atiende como nueva, sin repetir nada.
  if (registro === undefined || Date.now() - registro.desde > VIGENCIA_MS) {
    registros.set(id, { huella: huellaPeticion, grabada: null, desde: Date.now() });
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

L'essentiel tient en deux lignes : l'entrée enregistre `desde: Date.now()`, et `tomarTurno` traite comme nouvelle une clé dont l'entrée a plus de `VIGENCIA_MS`. L'exécution :

```text
$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: vence-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
201 /servicios/7

$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: vence-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
201 /servicios/7

$ sleep 6

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: vence-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
{"type":"https://revisor.example/problemas/nombre-repetido","title":"Ya existe un servicio con ese nombre","status":409,"detail":"ya existe un servicio llamado avisos","instance":"/servicios","existente":"/servicios/7"}
 [409]

$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: vence-2' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200"}'
201 /servicios/8

$ curl -o /dev/null -w '%{http_code}\n' -X DELETE http://127.0.0.1:18080/servicios/8 -H 'Authorization: Bearer escritura-a'
204

$ sleep 6

$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: vence-2' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200"}'
201 /servicios/9

--- terminal del revisor:
revisor en http://127.0.0.1:18080
POST /servicios
POST /servicios
idempotencia: la llave vence-1 ya se atendió; repito su respuesta
POST /servicios
POST /servicios
DELETE /servicios/8
POST /servicios
```

Première expérience : `201`, `201` répété (dans la durée de validité) et, six secondes plus tard, `409` `nombre-repetido`. La clé a expiré, le `revisor` a traité l'enregistrement comme nouveau, et il a été arrêté par la règle du nom unique. Sans cette règle, il aurait créé un autre `avisos`.

Seconde expérience : `201` avec l'id 8, le retrait et, six secondes plus tard, `201` avec l'id **9**. La clé avait expiré et le nom était déjà libre, si bien que la nouvelle tentative a créé un nouveau service. C'est exactement la frontière de 6.7.1 : **passée la durée de validité, une nouvelle tentative n'est plus protégée**. Dans les cinq secondes, la même requête aurait reçu le `201` enregistré de l'id 8. Si ton API publie une durée de validité de 24 heures, tes clients doivent savoir qu'une nouvelle tentative du lendemain peut dupliquer.

### Solution 4

```text
$ for ruta in codigo/504 cortar codigo/500; do curl -o /dev/null -w "%{http_code} %header{location}\n" -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d "{\"nombre\":\"e-${ruta#*/}\",\"url\":\"http://127.0.0.1:18081/$ruta\"}"; done
201 /servicios/7
201 /servicios/8
201 /servicios/9

$ for id in 7 8 9; do curl -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:18080/servicios/$id/revisiones -H 'Authorization: Bearer escritura-a'; done; curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/5/revisiones -H 'Authorization: Bearer admin'
202 202 202 202

$ sleep 8

$ for i in 1 2 3 4; do curl http://127.0.0.1:18080/revisiones/$i -H 'Authorization: Bearer escritura-a'; done
{"id":1,"servicio":7,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":504,"ms":1,"detalle":"504"}}
{"id":2,"servicio":8,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":null,"ms":null,"detalle":"respuesta inválida"}}
{"id":3,"servicio":9,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":500,"ms":2,"detalle":"500"}}
{"id":4,"servicio":5,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":null,"ms":null,"detalle":"tiempo agotado"}}

--- terminal del laboratorio:
laboratorio en http://127.0.0.1:18081/codigo/NNN
GET /codigo/504
GET /cortar
GET /codigo/500
GET /lento/3000
GET /cortar
GET /codigo/504
GET /codigo/504
GET /cortar
GET /lento/3000
GET /lento/3000
```

`/codigo/504` apparaît trois fois : un `504` peut s'améliorer de lui-même et ne porte pas de `Retry-After`. `/cortar` apparaît trois fois : le laboratoire ferme la connexion sans répondre, la requête se termine en `respuesta-invalida`, et cela aussi est réessayé (celui qui interroge n'a pas la preuve que le service est cassé pour toujours). `/codigo/500` apparaît **une fois** : le `revisor` ne réessaie pas un `500`. Et `/lento/3000` apparaît trois fois : chaque tentative expire au bout de 1 000 ms.

Les détails sont ceux de la dernière tentative : `504`, `respuesta inválida`, `500` et `tiempo agotado`. Les huit secondes s'expliquent par `reportes` : trois tentatives de jusqu'à 1 000 ms chacune plus deux attentes de jusqu'à 500 et 1 000 ms, plus la seconde que chaque vérification attend dans la file, cela fait jusqu'à cinq secondes et demie. Avec quatre, le résultat de `reportes` pourrait encore être `pendiente`.

## Comment savoir que tu as réussi

- [ ] Tu dis de mémoire quelles méthodes sont sûres et lesquelles idempotentes selon la RFC 9110, et pourquoi `POST` et `PATCH` ne le sont pas.
- [ ] Un `DELETE` répété donne `204` puis `410`, et tu expliques pourquoi il reste idempotent ; un `PUT` répété avec le même `If-Match` donne `200` puis `412`, et en relisant tu retrouves ton changement.
- [ ] `node fig06_02.ts` montre les mille nouvelles tentatives dans une seule fenêtre sans *jitter* et réparties en cinq avec *jitter*.
- [ ] Une vérification d'un service qui répond `502` appelle trois fois le laboratoire ; une de `pagos` (`503` avec `Retry-After: 120`) et une d'un `404` n'appellent qu'une seule fois.
- [ ] Deux `POST /servicios` avec la même `Idempotency-Key` donnent le même `201` et le même `Location`, et la liste ne contient qu'un seul service ; avec un autre corps, ils donnent `422` `llave-reutilizada` ; en même temps, `409` `llave-en-curso`.
- [ ] `node alta-segura.ts agenda http://127.0.0.1:18081/codigo/200` donne `502` puis `201` ; avec `--sin-llave`, `502` puis `409` avec `existente`.
- [ ] Avec un `422`, `alta-segura.ts` fait une seule requête et sort avec `1` ; avec `503:2 201` sur le serveur simulé, il attend 2 s et sort avec `0` ; avec `409:en-curso 201`, il réessaie et sort avec `0`, et avec `mudo` et `ALTA_LIMITE_MS=300`, il interrompt quatre tentatives par le délai et sort avec `1`.
- [ ] Avec le `revisor` arrêté, la passerelle répond `502` et continue d'écouter ; `alta-segura.ts` attend trois fois (jusqu'à 500, 1 000 et 2 000 ms), dit « se agotaron los 4 intentos » et sort avec le code `1` ; sans passerelle, ses quatre tentatives disent `sin respuesta (ECONNREFUSED)` et il n'y a pas de pile de Node.
- [ ] Tu expliques, avec une exécution pour chacun, combien de temps dure une clé dans le `revisor`, pourquoi des champs dans un autre ordre donnent `422` et pourquoi la réponse enregistrée peut désigner un service retiré.
- [ ] Tu dis qu'`Idempotency-Key` est un brouillon expiré de l'IETF et non un standard, et ce qu'une API qui l'utilise doit publier.
- [ ] `node fig06_03.ts` donne `5 de 5`, et contre `defectos/sin-huella/` il donne `4 de 5`.
- [ ] À la fin, aucun programme n'écoute plus : `curl -i http://127.0.0.1:18080/`, `curl -i http://127.0.0.1:18081/` et `curl -i http://127.0.0.1:18082/` donnent l'erreur 7.

## Résumé

Réponds sans regarder la leçon :

1. Qu'est-ce qu'une méthode sûre et qu'est-ce qu'une méthode idempotente ? Lesquelles sont-elles, selon la RFC 9110 ?
2. Que promet l'idempotence et que ne promet-elle pas ? Donne un exemple de chaque avec le `revisor`.
3. Quelles sont les deux questions avant de réessayer ? Pourquoi le `revisor` ne réessaie-t-il pas un `500` ?
4. Quel est le plafond de l'attente de la tentative `n` avec une base de 250 ms et un plafond de 2 000 ? Qu'ajoute le *jitter* complet et pourquoi ?
5. Que fait le `revisor` quand un service répond `Retry-After: 120` ? Pourquoi n'attend-il pas 5 s pour réessayer ?
6. Que signifie un `502` pour celui qui a fait un `POST` ? Que peut-il faire sans clé et que peut-il faire avec une clé ?
7. Où en est `Idempotency-Key` à l'IETF ? Quels codes le brouillon propose-t-il et pour quel cas chacun ?
8. Pourquoi la clé est-elle créée une fois par intention et non une fois par tentative ?
9. Nomme quatre choses que la clé du `revisor` ne couvre pas.
10. Si les quatre tentatives d'`alta-segura.ts` échouent, combien d'attentes fait-il, que dit-il à la fin et avec quel code sort-il ? Pourquoi n'attend-il pas après la dernière tentative ?
11. Quand `alta-segura.ts` sort-il avec `0` ? Que fait-il d'un `Retry-After` de 2 s et d'un de 120 s ? Qu'est-ce qui distingue le `409` qu'il réessaie de celui qu'il ne réessaie pas ?

## Sources

Toutes ont été consultées le 21 octobre 2026.

1. [RFC 9110, *HTTP Semantics*, section 9.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.1) (juin 2022, standard d'internet) : les méthodes sûres, l'exemple du journal d'accès et la responsabilité de qui conçoit l'URI.
2. [RFC 9110, section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2) : les méthodes idempotentes, la répétition automatique après une défaillance de communication, « though the response might differ », le client qui ne doit pas réessayer des méthodes non idempotentes, le proxy qui ne doit pas le faire et la nouvelle tentative d'une nouvelle tentative.
3. [RFC 9110, sections 9.3.3, 9.3.4 et 9.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.3) : `POST`, `PUT` et `DELETE`.
4. [RFC 9110, section 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3) : `Retry-After`, ses deux formes et sa signification avec un `503`.
5. [RFC 9110, sections 15.6.3, 15.6.4 et 15.6.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.3) : `502`, `503` et `504`.
6. [RFC 6585, *Additional HTTP Status Codes*, section 4](https://www.rfc-editor.org/rfc/rfc6585.html#section-4) : le `429` et son `Retry-After`.
7. [RFC 5789, *PATCH Method for HTTP*, section 2](https://www.rfc-editor.org/rfc/rfc5789.html#section-2) : `PATCH` n'est ni sûr ni idempotent.
8. [*The Idempotency-Key HTTP Header Field*, draft-ietf-httpapi-idempotency-key-header-07](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07) (J. Jena et S. Dalal, 15 octobre 2025, brouillon de l'IETF, expiré le 18 avril 2026) : syntaxe (2.1), unicité (2.2), durée de validité (2.3), empreinte (2.4), responsabilités (2.5), quoi faire (2.6), les erreurs `400`, `409` et `422` (2.7), implémentations (4) et sécurité (5).
9. [Datatracker de l'IETF, page du brouillon](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/) : statut « Expired Internet-Draft », groupe de travail `httpapi`, révision 07.
10. [RFC 9651, *Structured Field Values for HTTP*, section 3.3.3](https://www.rfc-editor.org/rfc/rfc9651.html#section-3.3.3) (septembre 2024, remplace la RFC 8941 que cite le brouillon) : les *Strings*, délimitées par des guillemets doubles.
11. [RFC 9562, *Universally Unique IDentifiers (UUIDs)*](https://www.rfc-editor.org/rfc/rfc9562.html) (mai 2024, remplace la RFC 4122 que cite le brouillon) : le format que le brouillon recommande pour la clé.
12. [Marc Brooker, *Exponential Backoff And Jitter*, AWS Architecture Blog](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) (4 mars 2015) : le *jitter* complet, l'« égal » et le « décorrélé », comparés.
13. [*Timeouts, retries, and backoff with jitter*, Amazon Builders' Library](https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter) (Marc Brooker, 2019) : les nouvelles tentatives comme quelque chose d'« égoïste », l'amplification de 243 fois avec cinq couches, réessayer en un seul point, le seau de jetons pour limiter les nouvelles tentatives et l'idempotence avec des jetons du client.
14. [Google, *Site Reliability Engineering*, « Addressing Cascading Failures »](https://sre.google/sre-book/addressing-cascading-failures/) : backoff exponentiel aléatoire, limite de nouvelles tentatives par requête, budget de nouvelles tentatives et l'exemple de 64 tentatives avec trois couches.
15. [Stripe, *Idempotent requests*](https://docs.stripe.com/api/idempotent_requests) : une API qui exploite le schéma à grande échelle : clés de jusqu'à 255 caractères, UUID v4 recommandé, pas de données personnelles, suppression à partir de 24 heures, comparaison des paramètres et résultats non enregistrés quand la validation échoue.
16. [Node.js, *Command-line API*, `--unhandled-rejections=mode`](https://nodejs.org/docs/latest-v24.x/api/cli.html) : dans la version 24, le mode par défaut est `throw` : une promesse rejetée que personne n'attrape est levée comme exception non capturée et le processus se termine ; c'est ce qui arriverait à une passerelle qui n'attrape pas l'échec de son `fetch` (6.5.1).
17. [MDN, `AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static) : renvoie un signal qui s'annule tout seul à l'expiration du délai ; l'erreur est une `TimeoutError`. C'est la limite par tentative d'`alta-segura.ts` (6.5.2).
18. [RFC 9112, *HTTP/1.1*, section 9.6](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.6) : la fermeture par étapes (demi-fermeture, continuer à lire, fermer complètement) et le `RST` qui peut effacer la dernière réponse ; c'est ce que fait `cerrarConCalma` dans `respuestas.ts`.

### Termes de cette leçon

| | |
|---|---|
| **méthode sûre** | celle qui, par sa sémantique, ne demande aucun changement d'état sur le serveur : `GET`, `HEAD`, `OPTIONS`, `TRACE` |
| **méthode idempotente** | celle qui, répétée, a le même effet recherché qu'une seule fois : les méthodes sûres, `PUT` et `DELETE` |
| **nouvelle tentative** | répéter une requête qui a échoué, à l'initiative du client |
| **backoff exponentiel** | attendre le double (jusqu'à un plafond) avant chaque nouvelle tentative |
| ***jitter* complet** | tirer l'attente au sort entre 0 et le plafond du backoff, pour que les clients ne réessaient pas ensemble |
| **amplification** | la multiplication de la charge quand plusieurs couches réessaient chacune de leur côté |
| **clé d'idempotence** | l'identifiant que le client invente une fois par opération pour que le serveur reconnaisse ses nouvelles tentatives |
| **empreinte** | le résumé du corps que le serveur conserve avec la clé pour savoir si une nouvelle tentative est la même requête |
| **réconcilier** | relire l'état du serveur pour savoir si une opération incertaine a eu lieu |

---

**Précédent :** [Leçon 5 — Problem Details (RFC 9457)](05-problem-details.md) · **Suivant :** [Leçon 7 — Celui qui lit l'erreur : le client du `revisor` et les agents d'IA](07-quien-lee-el-error.md)

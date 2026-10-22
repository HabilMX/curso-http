# Journal de bord

Ce carnet t'appartient. C'est lui qui fait de ce cours *ton* cours.

**Ce qu'il faut noter :** le code que tu aurais écrit avant ce cours et celui que tu écris maintenant · la réponse de `curl` que tu n'as pas su lire · ce que tu croyais savoir sur HTTP et qui s'est révélé faux · l'erreur de ta propre API que tu as reconnue dans l'une des leçons.

**Pourquoi c'est important :** dans deux semaines, tu ne te souviendras plus de ce qui t'a donné du mal. Et c'est exactement ce qu'il faut réviser.

---

## Leçon 0 — Le contrat qui voyage par HTTP

_date :_

- Versions que j'ai obtenues (`node -v`, `curl --version`) :
- Une API à moi ou à un tiers qui répond `200` avec l'erreur dans le corps :
- Ce qui m'a surpris dans la réponse de `curl -i` :

## Leçon 1 — Succès et redirections

_date :_

- Un de mes `POST` qui aurait dû répondre `201` ou `202` et ce qu'il répondait :
- `301` ou `308` ? Ce qui s'est passé avec le corps du `POST` dans chaque cas :
- Un `304` que j'ai vu et ce qu'il a permis d'économiser :

## Leçon 2 — Le client s'est trompé (I)

_date :_

- La différence entre `401` et `403` avec mes propres mots :
- Une ressource où j'ai choisi `404` exprès pour la cacher, et pourquoi :
- Un `405` auquel il manquait `Allow` :

## Leçon 3 — Le client s'est trompé (II)

_date :_

- La mise à jour perdue : ce qui s'est passé avant et après `If-Match` :
- Ma règle écrite pour choisir entre `400` et `422` :
- Un cas où j'ai hésité entre `409` et `412` :

## Leçon 4 — Capacité et défaillances du serveur

_date :_

- Une erreur de mon serveur qui en disait plus qu'elle ne devait :
- `500`, `502` ou `504` ? Le cas que j'ai eu du mal à trancher :
- Ce que fait mon client quand il reçoit `429` avec `Retry-After` :

## Leçon 5 — Problem Details

_date :_

- Les types de problème (`type`) que j'ai définis pour mon API :
- Un champ que j'ai voulu mettre dans `title` et qui relevait de `detail` :
- Ce que j'ai laissé hors du corps exprès :

## Leçon 6 — Nouvelles tentatives et idempotence

_date :_

- Une de mes opérations qui ne peut pas être répétée sans créer de doublon :
- Combien de réessais et quel délai d'attente j'ai choisis, et pourquoi :

## Leçon 7 — Celui qui lit l'erreur

_date :_

- Un code que mon client traitait comme un autre et qu'il distingue désormais :
- Ce qui change quand celui qui lit l'erreur est un programme et non une personne :

## Leçon 8 — Le contrat vérifiable

_date :_

- Combien des 23 scénarios sont passés du premier coup :
- Le scénario qui m'a obligé à corriger mon API :
- Ce qu'il me manque pour pouvoir la publier :

---

## Ce que je veux construire ensuite

_La liste des choses qui te viennent à l'esprit pendant que tu avances. C'est le meilleur signe que le cours a fonctionné._

-

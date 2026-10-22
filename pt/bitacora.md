# Diário de bordo

Isto é pessoal. É o que faz do curso um curso próprio.

**O que anotar:** o código que a gente usaria antes deste curso e o que usa agora · a resposta do `curl` que a gente não soube interpretar · o que a gente achava sobre HTTP e acabou sendo diferente · o erro da própria API que a gente reconheceu em uma das lições.

**Por que importa:** em duas semanas a gente não vai lembrar o que foi difícil. E o que foi difícil é exatamente o que precisa ser revisado.

---

## Lição 0 — O contrato que viaja por HTTP

_data:_

- Versões que obtive (`node -v`, `curl --version`):
- Uma API minha ou de terceiros que responde `200` com o erro no corpo:
- O que me surpreendeu na resposta do `curl -i`:

## Lição 1 — Sucessos e redirecionamentos

_data:_

- Um `POST` meu que deveria responder `201` ou `202` e o que respondia:
- `301` ou `308`? O que aconteceu com o corpo do `POST` em cada caso:
- Um `304` que vi e o que economizou:

## Lição 2 — O cliente errou (I)

_data:_

- A diferença entre `401` e `403` dita com as minhas palavras:
- Um recurso em que escolhi `404` de propósito para escondê-lo, e por quê:
- Um `405` em que faltava `Allow`:

## Lição 3 — O cliente errou (II)

_data:_

- A atualização perdida: o que aconteceu antes e depois de `If-Match`:
- Minha política escrita para `400` versus `422`:
- Um caso em que fiquei em dúvida entre `409` e `412`:

## Lição 4 — Capacidade e falhas do servidor

_data:_

- Um erro do meu servidor que dizia mais do que devia:
- `500`, `502` ou `504`? O caso que foi difícil decidir:
- O que o meu cliente faz quando recebe `429` com `Retry-After`:

## Lição 5 — Problem Details

_data:_

- Os tipos de problema (`type`) que defini para a minha API:
- Um campo que quis pôr em `title` e que pertencia a `detail`:
- O que deixei fora do corpo de propósito:

## Lição 6 — Retentativas e idempotência

_data:_

- Uma operação minha que não se pode repetir sem duplicar:
- Quantas novas tentativas e com que tempo de espera decidi, e por quê:

## Lição 7 — Quem lê o erro

_data:_

- Um código que o meu cliente tratava igual a outro e não trata mais:
- O que muda quando quem lê o erro é um programa e não uma pessoa:

## Lição 8 — O contrato verificável

_data:_

- Quantos dos 23 cenários passaram de primeira:
- O cenário que me obrigou a corrigir a minha API:
- O que me falta para poder publicá-la:

---

## O que quero construir depois

_A lista de ideias que surgirem enquanto a gente avança. É o melhor sinal de que o curso funcionou._

-

# Erros que ensinam: códigos HTTP e Problem Details — uma API que diz a verdade quando falha

**Por Dorian Chávez, fundador da Hábil e arquiteto de integração.**

**Para quem é:** quem já escreveu uma API em qualquer linguagem e alguma vez respondeu `200` com um corpo que dizia `{"error": …}`, usou `500` para tudo o que deu errado, ou não soube explicar a diferença entre `401` e `403`, entre `409` e `412`, entre `400` e `422`; e quem consome APIs de terceiros e quer deixar de adivinhar o que fazer quando elas falham. É um curso de nível intermediário: pressupõe-se que já se saiba o que é uma requisição HTTP, o que é JSON e como subir um servidor. Não se pressupõe conhecer as especificações: cada código é explicado quando aparece, e explica-se por que ele existe, não só qual número usar.

**O que se vai saber ao terminar:** escolher o código correto com uma pergunta que dá para responder, produzir respostas de erro que uma máquina consegue interpretar (o formato dos *Problem Details* do RFC 9457), decidir o que se tenta de novo e o que não, e demonstrar com `curl` que a API faz o que diz. E ganhar autonomia para ler as especificações por conta própria.

**O que é preciso antes de começar:** um computador com Linux Mint, saber abrir um terminal e ler um programa curto em TypeScript. Os programas usam Node 24 sem uma única dependência, e o instrumento de todo o curso é o `curl`. A [Lição 0](00-el-contrato-que-viaja.md) deixa o ambiente pronto.

**Para onde ir depois:** para ver o mesmo cuidado aplicado a uma API inteira, os artigos da Hábil sobre [APIs prontas para agentes de IA](https://www.habil.mx/pt/blog/apis-prontas-para-agentes-de-ia/), sobre [segurança de APIs](https://www.habil.mx/pt/blog/seguranca-de-apis-cto-identidade-gateway-tokens/) e sobre [REST ou gRPC](https://www.habil.mx/pt/blog/rest-ou-grpc-quando-convem-cada-um/) continuam de onde este curso termina.

## O projeto que vai ser construído

O **`revisor`**, o programa que verifica o estado de uma lista de serviços (nome, estado e tempo de resposta), com **duas faces**:

- Como **servidor**, uma pequena API para administrar a lista de serviços observados: cadastrar, consultar, alterar, remover e pedir uma verificação. É a face que *produz* erros, e tem que produzi-los bem.
- Como **cliente**, o que consulta os serviços e decide, conforme o que eles respondem, se estão disponíveis, limitados, em manutenção ou fora do ar, e se vale a pena tentar de novo. É a face que *lê* erros.

É o mesmo problema dos cursos de Go, Rust e TypeScript da Hábil. O que muda é a pergunta: não «foi possível consultar?», mas «o que o serviço *disse* e o que fazer com isso?». E, para provocar cada código à vontade, a lição 0 constrói um servidor de testes que responde o código que lhe for pedido.

## As nove lições

São nove e não dez porque o catálogo é limitado (23 códigos) e uma única especificação governa o corpo do erro. As respostas de sucesso e os redirecionamentos dividem a lição 1 porque, em uma API, o difícil neles são as mesmas três decisões.

| Lição | | O que se constrói | O que se aprende |
|---|---|---|---|
| 0 | [O contrato que viaja por HTTP](00-el-contrato-que-viaja.md) | o servidor de testes e o instrumento: `curl -i` | linha de status, cabeçalhos e corpo; as cinco famílias; o código manda e o corpo explica; o que uma máquina faz com um código que não conhece; os registros oficiais |
| 1 | [Sucessos e redirecionamentos: 200, 201, 202, 204, 301, 308 e 304](01-exitos-redirecciones.md) | as rotas que cadastram, consultam e removem serviços; a rota legada | devolver, criar, aceitar ou não devolver nada; `Location`; `202` e o recurso de acompanhamento; `301` versus `308`; `ETag` e `If-None-Match`. **Quadro de segurança:** SSRF; o `revisor` rejeita loopback, redes privadas, link-local ou metadados e ULA, valida isso antes de cada conexão (depois de resolver o DNS), e o laboratório admite apenas uma exceção por IP e porta exatos; a defesa completa contra o *DNS rebinding* chega na lição 8 |
| 2 | [O cliente errou (I): 400, 401, 403, 404, 405 e 415](02-errores-del-cliente-peticion.md) | o ponto de entrada da API | sete passos em ordem: rota → método → credencial → permissão → existência → formato → leitura; `WWW-Authenticate` e `Allow`; quando um `404` esconde de propósito; o `413` do limite de 16 KiB do corpo (rede de segurança, fora dos 23). **Quadro de segurança:** o `404` que esconde de propósito e a enumeração de recursos |
| 3 | [O cliente errou (II): 409, 410, 412, 422 e 428](03-errores-del-cliente-estado.md) | a alteração de um serviço sem sobrescrever a de outra pessoa | conflito, regra de negócio e pré-condição; a atualização perdida; `ETag` com `If-Match`; `410` versus `404`; `400` versus `422`; **versões de API**: a descontinuação anunciada antes do `410`, com `Deprecation` (RFC 9745) e `Sunset` (RFC 8594) |
| 4 | [Capacidade e falhas do servidor: 429, 500, 502, 503 e 504](04-capacidad-y-fallas-del-servidor.md) | limite de requisições, manutenção e uma dependência lenta | de quem é a culpa; `Retry-After`; `500`, `502` e `504`; o que jamais se diz em um erro do servidor. **Quadro de segurança:** o que jamais se diz em um erro e o `429` como defesa |
| 5 | [Problem Details (RFC 9457)](05-problem-details.md) | o *handler* central de erros | `application/problem+json`; os cinco membros; `type` estável; extensões; vários problemas; do RFC 7807 ao 9457; com `about:blank`, o `title` vai em inglês, porque o RFC 9457 (§4.2.1) pede que seja a frase do status HTTP, enquanto o `detail` pode ir em espanhol |
| 6 | [Retentativas e idempotência](06-reintentos-idempotencia.md) | um `POST` que pode ser repetido sem duplicar | métodos seguros e idempotentes; *backoff* exponencial com *jitter*; `Idempotency-Key` e por que ainda não é um padrão |
| 7 | [Quem lê o erro: o cliente do `revisor` e os agentes de IA](07-quien-lee-el-error.md) | a classificação das respostas dos serviços verificados | tabela de decisão por código e por `type`; corrigir, reautenticar, esperar, reconciliar ou desistir; como um agente de IA usa os mesmos campos |
| 8 | [O contrato verificável](08-contrato-verificable.md) | a descrição OpenAPI e a matriz de 23 cenários | documentar cada erro em OpenAPI 3.1; o catálogo de tipos de problema; a matriz `curl` completa; as versões de API no OpenAPI |

No final de cada lição há exercícios com as soluções. E o [diário de bordo](bitacora.md) é de quem estuda: anote ali o que deu trabalho.

## Os 23 códigos do curso

| Família | Códigos | Lição |
|---|---|---|
| Sucesso | `200`, `201`, `202`, `204` | 1 |
| Redirecionamento e cache | `301`, `308`, `304` | 1 |
| O cliente errou: a requisição | `400`, `401`, `403`, `404`, `405`, `415` | 2 |
| O cliente errou: o estado | `409`, `410`, `412`, `422`, `428` | 3 |
| Capacidade e falhas do servidor | `429`, `500`, `502`, `503`, `504` | 4 |

Outros aparecem de passagem, para dizer em que se distinguem dos anteriores (`302`, `307`, `406`, `501`). O `413` também não está entre os 23, mas o `revisor` o responde: é a rede de segurança do limite de 16 KiB do corpo, que a lição 2 explica junto com o `415`. De cada código o curso ensina **quando sim, quando não (e qual vai no lugar) e a resposta mínima correta**.

## Três princípios que atravessam todo o curso

**O código manda e o corpo explica, e os dois dizem a mesma coisa.** O código de status é o que lê qualquer máquina do caminho (o navegador, o cache, o balanceador, o monitor); o corpo é para quem precisa do detalhe. Um corpo que contradiz o código, ou que o substitui, quebra todos os que não o leem.

**Um erro bem projetado diz o que fazer.** Corrigir a entrada, autenticar-se, esperar, reler o estado ou desistir: quase sempre quem recebe o erro é um programa, e um programa não adivinha. Por isso cada lição termina com a pergunta «o que deve fazer quem recebe isto?».

**O que sai da API é projetado de propósito.** Um erro é uma superfície pública. O que não se diz —*stack traces*, consultas, caminhos, nomes de máquinas, chaves— importa tanto quanto o que se diz, e é ensinado onde aparece, não em um módulo final de segurança.

**Um aviso de honestidade:** `Idempotency-Key` e os cabeçalhos `RateLimit-*` **ainda não são um padrão**; circulam como rascunhos da IETF. O curso os ensina como um padrão de projeto que a API documenta e não como um requisito do HTTP, e diz isso toda vez que aparecem.

## Como saber que terminou

O curso não termina quando a lição 8 foi lida, mas quando a API cumpre estas cinco coisas. São as mesmas que a verificação confere a cada alteração:

1. **A matriz de 23 cenários roda com um único comando**, e cada linha confere código, cabeçalhos obrigatórios, tipo de conteúdo e corpo.
2. **Nenhuma resposta de erro é `200` nem HTML.** Todas são `application/problem+json` com um `type` estável.
3. **Nenhum corpo de um `5xx` contém *stack traces*, consultas, caminhos nem chaves.**
4. **Um `POST` repetido com a mesma chave não duplica nada.** Se a mesma chave chega com OUTRO corpo, a resposta é `422`; se chega enquanto a requisição original ainda está em andamento, a resposta é `409`. Isso vem do rascunho da IETF «The Idempotency-Key HTTP Header Field» (`draft-ietf-httpapi-idempotency-key-header-07`, expirado em 18 de abril de 2026), que NÃO é um padrão.
5. **O `revisor` classifica os 23 casos com uma tabela** e não tenta de novo o que não deve ser repetido.

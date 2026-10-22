# Lição 6 — Retentativas e idempotência

São 23h50 do último dia do mês e a equipe de operações está cadastrando, com um script, os catorze serviços novos que o `revisor` precisa vigiar a partir da meia-noite. O script não fala diretamente com o `revisor`: passa pelo gateway da empresa, como tudo o mais. Às 23h52 o gateway tem um mau minuto. O script envia o cadastro de `agenda`, o `revisor` o recebe, o guarda e responde `201`, e essa resposta se perde no caminho de volta. Ao script chega um `502 Bad Gateway`. Quem o escreveu foi prudente: diante de um `502`, tenta de novo. A segunda tentativa passa, e o `revisor` responde `409 Conflict`: «ya existe un servicio llamado agenda». O script trata o `409` como um erro, para e deixa treze serviços sem cadastrar. À meia-noite começam as revisões e metade do painel está vazia. Ninguém sabe se `agenda` foi criado pelo script ou por outra pessoa, porque o `409` não diz. E a pessoa de plantão, para não arriscar, apaga `agenda` e a cria de novo manualmente, justo quando outro colega relança o script completo.

Nenhuma dessas decisões era tola. O que faltava era uma forma de **repetir uma requisição sem medo de que ela faça duas vezes a mesma coisa**, e uma regra clara de **quando** repeti-la. É isso que esta lição constrói.

**Tempo:** 2 × 45 min (o corte está entre as seções 6.4 e 6.5)

**O que se constrói:** um `POST /servicios` que pode ser repetido sem duplicar enquanto o servidor se lembrar da chave (a seção 6.7 diz até onde isso vai), com o cabeçalho `Idempotency-Key`; um gateway que perde respostas de propósito, para ver o `502` que não diz se a escrita aconteceu; um cliente que tenta de novo o cadastro com a mesma chave; as revisões do `revisor` com retentativas, backoff exponencial e *jitter*; e um programa que verifica a idempotência do cadastro

**O que se aprende:** o que são os métodos seguros e os idempotentes segundo a RFC 9110, e o que a idempotência **não** promete; as duas perguntas que decidem uma retentativa; o backoff exponencial com *jitter* completo e por que o acaso protege o servidor; quando obedecer `Retry-After` e quando não esperar; `Idempotency-Key` e por que ainda **não é um padrão**; quanto dura uma chave, o que acontece se o corpo mudar e o que ela não cobre; e o que fazer com um `502` que não diz se a escrita aconteceu

**De onde se parte.** Da [Lição 5](05-problem-details.md), com um `revisor` cujos erros já são Problem Details: um `type` estável, um `title` que não muda, um `detail` para a pessoa que lê. Na [Lição 4](04-capacidad-y-fallas-del-servidor.md) aprendeu-se a ler `Retry-After` nas duas formas, e viu-se que uma revisão de `pagos` fica com `"detalle":"503 (reintentar en 120 s)"`, mas o `revisor` não fazia nada com esse número. Na [Lição 1](01-exitos-redirecciones.md) viu-se que um segundo `DELETE` não muda nada, e que isso tinha nome: idempotência. Esta lição junta as três coisas. Até aqui, repetir um cadastro cria outro serviço ou bate no `409` do nome repetido sem que se saiba se o serviço era de quem repetiu, e as revisões nunca tentam de novo.

**O que esta lição não faz.** Não escreve a tabela que decide o que fazer com cada código do lado do cliente; isso é a [Lição 7](07-quien-lee-el-error.md), que também decide o que fazer com o `409` de uma chave em andamento. Não documenta o cabeçalho em OpenAPI; isso é a [Lição 8](08-contrato-verificable.md). Não guarda as chaves em um banco de dados: o `revisor` as guarda em memória, e a seção 6.7 diz o que muda em uma API real. E não implementa um orçamento de retentativas compartilhado nem um circuit breaker: ambos são mencionados em 6.3.3 porque existem e convém conhecê-los, mas o `revisor` apenas limita quantas vezes cada consulta é tentada de novo.

**Sobre as execuções.** O Linux Mint 22 é o sistema de referência do curso. As saídas desta lição foram obtidas em 21 de outubro de 2026 no macOS com Node 24.14.1 e curl 8.7.1, adicionando `-sS` a cada `curl` porque a saída ia para um arquivo (`-s` desativa o indicador de progresso, `-S` permite ver os erros, e nenhum dos dois altera a resposta). Todas as séries foram executadas nas portas 18080, 18081 e 18082, que são as que devem ser digitadas, sobre a versão final dos programas, e cada arquivo `.salida.txt` é a captura tal como saiu, exceto que nas linhas de comandos o `-sS` foi removido (`fig06_02.salida.txt` não usa servidores: é uma amostragem aleatória). As versões quebradas de «O erro a ser observado» e a solução do exercício 3 foram executadas a partir de cópias em outras pastas; nas saídas, o verificador aparece como `node fig06_03.ts`, que é como será executado na máquina local. Na execução local mudam a data de `Date`, os oito dígitos finais de cada `ETag` (o `revisor` os sorteia ao iniciar), os milissegundos medidos, as esperas que o *jitter* sorteia (as de `fig06_02.ts` são diferentes a cada vez, de propósito), as chaves que `alta-segura.ts` inventa e os nomes que `fig06_03.ts` inventa. O `revisor` guarda tudo em memória, serviços e chaves: para obter o mesmo resultado da lição, inicie de novo o laboratório, o `revisor` e o gateway antes de cada série de requisições. Não foi executado em uma instalação de desktop do Mint, e nada do que se usa depende do macOS. Os programas estão em [`programas/06-reintentos-idempotencia/`](../programas/06-reintentos-idempotencia), no repositório do curso: o `revisor` em `fig06_01/`, o backoff visto de perto em `fig06_02.ts`, o verificador de idempotência em `fig06_03.ts`, o servidor simulado em `fig06_04.ts`, as versões quebradas em `defectos/`, a solução do exercício 3 em `ejercicios/ej3/` e cada execução em seu arquivo `.salida.txt` (a das tentativas esgotadas, em `agotados.salida.txt`). Todos passam no `tsc` em modo estrito (seção 6.10).

## Ao terminar, será possível

- Dizer, para cada método do HTTP, se é seguro, se é idempotente ou nenhuma das duas coisas, citando a RFC 9110, e demonstrá-lo repetindo uma requisição contra o `revisor` e comparando o estado antes e depois.
- Explicar por que um `DELETE` repetido que responde `204` e depois `410` continua sendo idempotente, e por que um `PUT` com `If-Match` repetido responde `412` embora a mudança dele tenha ocorrido.
- Decidir se uma falha merece uma retentativa com duas perguntas, pode melhorar sozinha? e é seguro repeti-la?, e justificar por que o `revisor` tenta de novo um `502` e não um `404`.
- Calcular o teto da espera de cada tentativa com backoff exponencial e *jitter* completo, e mostrar com uma execução que o acaso distribui as retentativas de mil clientes.
- Fazer com que um `POST` repetido com a mesma `Idempotency-Key` devolva a mesma resposta sem criar outro recurso, e provocar as duas rejeições que o rascunho propõe: `422` se a chave chega com outro corpo e `409` se a original continua em andamento.
- Explicar os limites de uma chave de idempotência: quanto dura, o que conta como «o mesmo corpo» e o que não cobre, cada um com uma execução que o demonstra.
- Explicar o que faz um cliente quando as tentativas se esgotam ou ninguém responde (sai com uma mensagem e com código `1`, sem esperar além do necessário), e provocar esses casos com o `revisor` ou o gateway desligados.
- Prever o que `alta-segura.ts` faz com um `4xx`, com um `Retry-After` curto e com um longo, com um servidor que não responde e com os dois `409`, e verificá-lo com o servidor simulado.
- Rodar um programa que verifique a idempotência do cadastro e interpretar sua falha contra uma versão quebrada de propósito.

## O porquê antes do como

Uma retentativa é a resposta mais natural a uma falha, e também a mais perigosa. Natural, porque muitas falhas são passageiras: um serviço que estava reiniciando, um gateway com um mau minuto, uma conexão que caiu. Perigosa, por duas razões que esta lição separa com cuidado.

A primeira é que **nem sempre se sabe se o que foi pedido aconteceu**. Quando uma requisição falha antes de chegar ao servidor, repeti-la é inofensivo: o servidor nunca a viu. Quando falha *depois* de o servidor a atender, mas antes de a resposta chegar, repeti-la é pedir a mesma coisa pela segunda vez. Do lado de quem pede, os dois casos parecem iguais: um `502`, um tempo esgotado, uma conexão cortada. A cena do início é justamente isso: o `revisor` criou `agenda`, e o script nunca ficou sabendo. Se a operação é ler, tanto faz. Se a operação é criar, cobrar, enviar um e-mail ou movimentar estoque, repeti-la pode duplicar o efeito.

A segunda razão é que **uma retentativa custa ao servidor**. Se um serviço falha porque está saturado e mil clientes tentam de novo no mesmo instante, o que ele recebe não é alívio, e sim outra onda de mil requisições, e depois outra. Uma retentativa mal feita converte um tropeço de dois segundos em uma queda de vinte minutos.

O HTTP já resolve parte do primeiro problema. A RFC 9110 classifica os métodos: alguns são **idempotentes**, e repeti-los deixa o servidor igual a fazê-los uma vez. Com eles a retentativa é segura por definição. Mas o método com que se criam coisas, `POST`, não é, e é justamente aquele cuja falha mais dói. Para ele, a indústria inventou um cabeçalho, `Idempotency-Key`, que um rascunho da IETF tentou padronizar sem chegar a ser publicado como RFC. O segundo problema, o do servidor saturado, resolve-se no cliente: esperar cada vez mais entre as tentativas, sortear a espera e obedecer ao servidor quando ele diz quanto esperar.

A lição tem quatro partes:

1. **O que pode ser repetido** (6.1 a 6.3): o `revisor` desta lição, os métodos seguros e idempotentes, e as duas perguntas que decidem uma retentativa.
2. **Como se repete** (6.4): backoff exponencial, *jitter* e `Retry-After`, com as revisões do `revisor`.
3. **O que não pode ser repetido… até que pode** (6.5 a 6.7): o `502` que não diz se a escrita aconteceu, `Idempotency-Key` e seus limites.
4. **O `revisor` completo** (6.8 a 6.10): os arquivos, a execução e o programa que o verifica.

## Os conceitos

### 6.1 O `revisor` desta lição

#### 6.1.1 O que muda

O `revisor` da Lição 5 ganha três arquivos e muda quatro:

- **`idempotencia.ts`** (novo) guarda, por credencial e por chave, o digest da requisição e a resposta que recebeu. É a seção 6.6.
- **`pasarela.ts`** (novo) é um programa à parte que escuta na porta 18082 e reenvia tudo ao `revisor`. Com o cabeçalho `X-Simular: perder-primera`, na primeira vez que vê uma requisição deixa o `revisor` atendê-la e descarta a resposta: ao cliente responde `502`. Se o `revisor` não responde (porque está desligado), também responde `502` e continua escutando. É a seção 6.5.
- **`alta-segura.ts`** (novo) é um cliente que cadastra um serviço através do gateway e tenta de novo com a mesma chave, até quatro vezes, e para assim que elas se esgotam. Obedece `Retry-After`, corta cada tentativa por tempo e sai com 0 somente se o cadastro foi feito. Também é da seção 6.5.
- **`servicios.ts`** lê `Idempotency-Key` no cadastro, e as revisões usam `revisarConReintentos` em vez de `revisar`.
- **`cliente.ts`** separa a classificação (`clasificar`) da consulta, e ganha o backoff com *jitter* e `revisarConReintentos`. É a seção 6.4.
- **`problemas.ts`** acrescenta dois tipos ao catálogo: `llave-en-curso` (`409`) e `llave-reutilizada` (`422`).
- **`respuestas.ts`** muda a leitura do corpo: quando passa do teto de 16 KiB, o `revisor` termina de ler o que o cliente ainda está enviando antes de responder o `413`, para que a resposta não se perca. É a seção 6.8.1.

Nenhuma rota, nenhum código do ponto de entrada e nenhum cabeçalho das lições anteriores muda. O cabeçalho novo é opcional: um cadastro sem ele se comporta exatamente como na Lição 5.

#### 6.1.2 Iniciar os três

O `revisor` vive em `~/curso-http/fig06_01/`; a seção 6.8 traz todos os seus arquivos. Abra três terminais nessa pasta:

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

Até a seção 6.5 o gateway não é usado, mas convém tê-lo no ar desde já. E um aviso que vale para toda a lição: o `revisor` guarda serviços, revisões e chaves em memória. Cada série de requisições desta lição começa com os três programas recém-iniciados; se a série seguir outra, devem-se pará-los com `Ctrl+C` e iniciá-los de novo, ou os ids e as respostas não vão coincidir.

### 6.2 Seguro e idempotente: o que diz a RFC 9110

#### 6.2.1 As duas propriedades

A RFC 9110 define duas propriedades dos métodos, e convém lê-las com cuidado porque se confundem.

Um método é **seguro** se sua semântica é essencialmente de somente leitura: quem o usa não pede, nem espera, nenhuma mudança de estado no servidor ([seção 9.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.1)). Os métodos seguros da RFC são `GET`, `HEAD`, `OPTIONS` e `TRACE`. «Seguro» não quer dizer que o servidor não faça nada: a própria RFC dá o exemplo do log de acessos, que cresce a cada `GET` e poderia até encher o disco. Quer dizer que o cliente não pediu esse efeito e não é responsável por ele.

Um método é **idempotente** se o efeito buscado no servidor com várias requisições idênticas é o mesmo que com uma só ([seção 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)). Os idempotentes da RFC são `PUT`, `DELETE` e todos os seguros. A palavra vem da matemática: aplicar uma operação duas vezes dá o mesmo que aplicá-la uma.

E a seção 9.2.2 diz para que serve a distinção, com uma clareza que vale a pena citar: os métodos idempotentes se distinguem porque **a requisição pode ser repetida automaticamente se a comunicação falhar antes de o cliente ler a resposta**. Se a conexão de um `PUT` foi fechada antes de receber qualquer coisa, o cliente pode abrir outra e repeti-lo: sabe que repeti-lo terá o mesmo efeito buscado, mesmo que a requisição original tivesse funcionado, «though the response might differ», ainda que a resposta possa ser diferente.

| Método | Seguro | Idempotente | Fonte |
|---|---|---|---|
| `GET`, `HEAD`, `OPTIONS`, `TRACE` | sim | sim | RFC 9110, 9.2.1 e 9.2.2 |
| `PUT`, `DELETE` | não | sim | RFC 9110, 9.2.2 |
| `POST` | não | não | RFC 9110, 9.3.3 |
| `PATCH` | não | não | RFC 5789, seção 2 |

`POST` não é idempotente porque sua semântica é «processe isto segundo as próprias regras» ([seção 9.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.3)), e uma de suas funções típicas é criar um recurso que o servidor ainda não identificou. Dois `POST` iguais podem criar dois recursos. `PATCH`, segundo a RFC 5789, não é nem seguro nem idempotente: um patch pode dizer «some um», e somar um duas vezes não é o mesmo que somá-lo uma.

A consequência prática está em uma linha da mesma RFC: **um cliente não deveria tentar automaticamente de novo uma requisição com um método não idempotente**, a menos que tenha alguma forma de saber que aquela requisição em particular é de fato idempotente, ou alguma forma de detectar que a original nunca foi aplicada. Essas duas saídas são exatamente o que será construído: a primeira é `Idempotency-Key`; a segunda, reconciliar (reler o estado e ver o que aconteceu). E uma linha mais abaixo, outra regra que importa a quem opera gateways: **um proxy não deve tentar automaticamente de novo requisições não idempotentes**. Um gateway que repete um `POST` por conta própria pode duplicar o que o cliente dele nunca pediu para duplicar.

#### 6.2.2 Vê-lo no `revisor`

Com os três programas recém-iniciados, repita cada operação duas vezes e observe o que resta. Comece por um `PUT` com sua etiqueta, como a Lição 3 ensinou:

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

O primeiro `PUT` mudou o limite para 1500 e respondeu `200` com uma etiqueta nova. O segundo, idêntico, respondeu `412`. E mesmo assim o estado final é o que foi pedido: `"limite_ms":1500`. A idempotência se cumpriu, porque o efeito de dois `PUT` é o mesmo que o de um; o que mudou foi a resposta, que é justamente o que a RFC adverte. O `412` não diz «a alteração não ocorreu»; diz «a etiqueta já não é a vigente». Quem tenta de novo um `PUT` condicional e recebe um `412` precisa reler antes de concluir que perdeu: pode ser que a versão vigente seja, precisamente, a dele.

Agora um `DELETE` duas vezes:

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

`204` e depois `410`. Respostas distintas, efeito idêntico: depois de um ou de dois `DELETE`, o serviço 4 está aposentado. Este é o caso que a Lição 1 antecipou. Um cliente que tenta de novo um `DELETE` e recebe `410` (ou `404`) não deveria tratá-lo como uma falha: o que ele queria já é verdade.

Agora um `POST` de cadastro duas vezes, sem mais nada:

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

O primeiro criou `avisos` com o id 7. O segundo não criou outro, mas não porque o `POST` seja idempotente: foi uma regra de negócio que o deteve, a de que o nome seja único dentro da equipe. Essa rede de proteção evitou um duplicado e, em troca, deixou a dúvida da cena: o `409` diz que `/servicios/7` existe, não diz quem o criou. Se a primeira tentativa tivesse se perdido no caminho, não se saberia se `/servicios/7` é de quem tentou ou de um colega que escolheu o mesmo nome.

E um `POST` que não tem nenhuma rede de proteção:

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

Duas requisições, duas revisões: `/revisiones/1` e `/revisiones/2`. Pedir uma revisão não é idempotente, e nada o impede. Aqui o custo é pequeno (uma consulta a mais ao serviço), mas observe o padrão: é a forma de qualquer `POST` que cria algo sem um dado que o torne único. Uma ordem de compra, um pagamento, uma mensagem.

#### 6.2.3 O que a idempotência não promete

Três coisas que se confundem com a idempotência e não são.

**Não promete a mesma resposta.** A RFC diz isso com todas as letras, e acabou-se de ver: `204` e `410`, `200` e `412`. Um cliente que compara a segunda resposta com a primeira para decidir se algo deu errado está medindo o que não é.

**Não promete que nada mude.** Um `PUT` com `If-Match: *` repetido deixa o mesmo conteúdo, mas o `revisor` sobe a versão a cada escrita, então a `ETag` muda de `"1-2-…"` para `"1-3-…"` (será visto no exercício 1). A RFC deixa espaço para isso: a idempotência se refere ao efeito que o usuário pediu, e o servidor é livre para manter histórico, logs ou versões à parte.

**Não é uma propriedade da rede, e sim do método e do servidor.** Que a RFC diga que `PUT` é idempotente é uma promessa que o servidor precisa cumprir. Se um servidor implementa um `PUT` que soma, ou um `DELETE` que apaga «o último», a promessa foi quebrada, e todos os clientes, proxies e bibliotecas que confiam nela vão duplicar efeitos sem saber. A RFC diz isso para os métodos seguros, e vale igual aqui: se um URI faz algo inseguro com um método seguro, a responsabilidade é de quem o projetou.

### 6.3 Quando tentar de novo e quando não

#### 6.3.1 As duas perguntas

Cada vez que uma requisição falha, o `revisor` (e qualquer cliente que se queira escrever) faz duas perguntas, nesta ordem:

1. **Pode melhorar sozinha?** Um serviço saturado, um gateway que está reiniciando, um tempo esgotado: esperar pode resolver. Uma credencial inválida, um serviço que não existe, um corpo malformado: não. Repetir o que não pode melhorar sozinho é gastar a paciência do servidor e a de quem espera.
2. **É seguro repeti-la?** Se o método é idempotente, sim. Se não é, somente com uma chave de idempotência ou se se sabe que a original nunca chegou.

Somente se as duas respostas forem «sim», tenta-se de novo. É um princípio de design, não uma norma: a RFC diz quando é *seguro* repetir, e cada API decide quando *vale a pena*.

#### 6.3.2 O que o `revisor` tenta de novo

As revisões do `revisor` são `GET` aos serviços que ele vigia: seguros e idempotentes, então a segunda pergunta é sempre «sim». A primeira é respondida pela função `vale` de `cliente.ts`:

| Desfecho da consulta | Pode melhorar sozinho? | Tenta de novo? |
|---|---|---|
| sem conexão, tempo esgotado, resposta que não é HTTP | pode: o que está atrás talvez esteja subindo | sim |
| `429 Too Many Requests` | sim: o limite se reinicia com o tempo | sim, se `Retry-After` não pedir mais de 5 s |
| `502`, `503`, `504` | sim: a falha é de algo que está atrás ou é temporária | sim (se a resposta trouxer `Retry-After`, com a mesma condição) |
| `500` | quase nunca: é um defeito do servidor | não |
| qualquer outro `4xx` | não: o que precisa mudar é a requisição | não |
| destino proibido (SSRF) | não: a regra não vai mudar | não |

O `500` merece uma linha à parte, porque muitos clientes sim o repetem. A RFC 9110 diz que um `500` é uma condição inesperada que impediu o servidor de cumprir; a Lição 4 o tratou como um defeito do servidor, e repetir uma requisição contra um defeito quase sempre reproduz o defeito. O `revisor` decide não tentar de novo. Outras APIs decidem diferente, e é uma decisão que se escreve, não uma que se herda de uma biblioteca.

Qualquer uma dessas respostas pode trazer `Retry-After` (o normal é vê-lo em um `429` ou um `503`): o servidor diz quanto esperar, e o `revisor` o obedece se for razoável. Será visto em 6.4.3.

#### 6.3.3 Quantas vezes, e em que camada

A RFC 9110 traz outra frase, no final da seção 9.2.2, que convém conhecer: **um cliente não deveria tentar automaticamente de novo uma retentativa automática que falhou**. Está escrita para o caso da conexão cortada (o user agent que reabre a conexão e repete uma vez), e seu espírito é claro: as retentativas precisam ter um fim. O `revisor` faz até três tentativas por consulta e `alta-segura.ts` até quatro, de modo que vão além dessa letra, e é uma decisão à vista: são clientes de uma aplicação que conhecem a operação, esperam cada vez mais e param em um teto fixo. Quem escrever um cliente genérico, que não sabe nada da operação, deve seguir a recomendação da RFC, que é a prudente: uma retentativa e pronto.

O número de tentativas importa mais do que parece, por causa da **amplificação**. O guia da Amazon sobre timeouts e retentativas explica isso com um exemplo: cinco camadas de serviços, cada uma tentando de novo três vezes por conta própria, multiplicam por 243 a carga sobre o banco de dados do fundo, justo quando ele está mais fraco. O livro de SRE do Google conta o mesmo fenômeno com três camadas: uma única ação de uma pessoa termina em 64 tentativas contra o banco de dados. As duas fontes chegam à mesma recomendação: **tentar de novo em um único lugar da cadeia**, limitar as retentativas por requisição e ter um orçamento de retentativas por processo que deixe de tentar quando se esgota (o livro de SRE dá o exemplo de 60 por minuto; o guia da Amazon propõe um token bucket).

No `revisor`, quem tenta de novo as revisões é o `revisor`, e mais ninguém. O gateway desta lição não repete nada: se o fizesse com um `POST`, quebraria a regra da RFC para os proxies.

### 6.4 Backoff exponencial com *jitter*

#### 6.4.1 Por que esperar mais a cada vez

Se uma requisição falhou porque o servidor está saturado, tentar de novo imediatamente piora o que se queria resolver. A ideia do **backoff exponencial** (*exponential backoff*) é esperar cada vez mais: um pouco depois da primeira falha, o dobro depois da segunda, o dobro outra vez depois da terceira, até um teto. Se a falha durava um segundo, a primeira retentativa a resolve. Se durava um minuto, as retentativas vão se espaçando e dão ao servidor espaço para se recuperar.

O `revisor` usa uma base de 250 ms e um teto de 2,000 ms. O teto do intento `n` é `250 × 2^n`, sem passar de 2,000: 500 ms antes da segunda tentativa, 1,000 antes da terceira, e depois já bateria no teto.

#### 6.4.2 Por que ao acaso

O backoff sozinho não basta. Se mil clientes falham no mesmo instante (porque o servidor caiu para todos ao mesmo tempo), e todos esperam exatamente 500 ms, aos 500 ms o servidor recebe as mil retentativas juntas. É a mesma onda, um pouco depois. A solução que Marc Brooker analisou e popularizou no blog de arquitetura da AWS em 2015, e que hoje é a prática comum, é sortear a espera: o ***jitter* completo** (*full jitter*) espera um tempo aleatório entre 0 e o teto. Brooker comparou três formas de sortear (completo, «igual» e «descorrelacionado»): a «igual» saiu perdendo, e entre as outras duas a diferença foi menos clara. O curso usa o completo porque é o mais simples de escrever e de explicar.

Assim se escreve em `cliente.ts` (fragmento):

```ts
export function esperaConJitter(intento: number, baseMs: number, topeMs: number): number {
  return Math.round(Math.random() * Math.min(topeMs, baseMs * 2 ** intento));
}
```

Para vê-lo, `fig06_02.ts` usa essa mesma função, sem servidor. Salve-o em `~/curso-http/fig06_02.ts`, ao lado da pasta `fig06_01/`, porque ele importa `./fig06_01/cliente.ts`. Primeiro sorteia cinco esperas para cada tentativa; depois simula mil clientes que falham no mesmo instante e tentam uma vez de novo, e conta quantas retentativas caem em cada janela de 100 ms:

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

A primeira tabela mostra o teto de cada tentativa e como as esperas caem em qualquer lugar abaixo dele: na tentativa 3 saiu desde 205 até 1,722 ms. A partir da tentativa 3, o teto já é o limite de 2,000. A segunda tabela é a que importa. Sem *jitter*, as mil retentativas caem na mesma janela, a de 500 ms: o servidor que estava subindo recebe mil requisições juntas. Com *jitter*, elas se distribuem em cinco janelas de umas duzentas cada. É a mesma quantidade de trabalho, mas o pico é cinco vezes menor. (Os três que caem em «500 ou mais» são os que sortearam um número tão perto de 500 que `Math.round` o arredondou para 500.) Os números locais serão diferentes; a forma, a mesma.

#### 6.4.3 `Retry-After` manda, com um teto

Quando o servidor diz quanto esperar, o cliente não adivinha: obedece. `Retry-After` ([RFC 9110, seção 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3)) indica quanto o user agent deveria esperar antes da requisição seguinte, em segundos (`120`) ou como uma data HTTP. Com um `503`, indica quanto se espera que o serviço continue indisponível (a mesma seção 10.2.3); a [seção 15.6.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.4) acrescenta que o servidor pode enviá-lo para sugerir quanto esperar antes de tentar de novo; com um `429`, a RFC 6585 permite usá-lo para dizer quando voltar a tentar. A Lição 4 ensinou a lê-lo de modo estrito: somente dígitos ou uma das três formas de data HTTP, sempre em GMT, e qualquer outra coisa é ignorada.

E se o servidor pede para esperar dois minutos? Uma revisão que fica dormindo dois minutos dentro de um `setTimeout` não serve a ninguém: o resultado chega tarde e, enquanto isso, ocupa memória. Por isso o `revisor` tem um teto: **se `Retry-After` pede mais de 5 segundos, não insiste** e anota no resultado o que o serviço disse. É a mesma preocupação do polling da Lição 1, que limitava a espera entre 1 e 5 segundos para que um servidor equivocado não o deixasse dormindo uma hora, mas aqui a decisão é outra. O polling pergunta pelo estado de um trabalho, uma leitura barata, e pode voltar a perguntar aos 5 s. Uma revisão que tenta de novo aos 5 s quando o serviço pediu 120 chega antes do que o serviço pediu: isso seria desobedecê-lo. O honesto é não tentar de novo e dizer por quê. Se `Retry-After` não vem, ou não pode ser lido, usa-se o backoff com *jitter*.

#### 6.4.4 As revisões com retentativas

`revisarConReintentos` junta tudo (fragmento de `cliente.ts`; o arquivo completo está em 6.8.1):

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

Convém lê-lo em voz alta: consulta uma vez; enquanto restarem tentativas e a falha valer a pena, olha se o serviço pediu uma espera; se pediu mais de 5 s, sai do loop; se pediu algo razoável, espera isso; se não pediu nada, sorteia; e volta a consultar. No final classifica **a última** consulta, com a mesma função de sempre, que a lição separou de `revisar` para poder usá-la aqui. Observe onde está a espera: dentro do corpo do `for`, imediatamente antes da consulta seguinte. Quando as tentativas se esgotam (`intento < INTENTOS` deixa de ser verdadeiro), o corpo já não é executado, de modo que nunca se espera depois da última consulta. A ordem das duas condições não muda isso: só evita chamar `vale` quando já não restam tentativas.

Para vê-lo trabalhar são necessários serviços que falhem de formas distintas. Com os três programas recém-iniciados, cadastre três serviços do laboratório: um que responde `502`, outro `429` (com `Retry-After: 30`) e outro `404`. Depois peça uma revisão de cada um e outra de `pagos`, que responde `503` com `Retry-After: 120`. As três primeiras com `escritura-a` e a quarta com `admin`, porque cada credencial tem três revisões por minuto (Lição 4):

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

Os quatro resultados dizem `CAIDO`, e na Lição 4 teriam dito o mesmo. A diferença está no terminal do laboratório, que imprime cada requisição que recebe:

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

Conte as linhas. `/codigo/503` aparece **uma vez**: pediu para esperar 120 s, mais que o teto, e o `revisor` não insistiu; por isso o detalhe conserva `(reintentar en 120 s)`. `/codigo/429` também aparece uma vez, pela mesma razão (30 s). `/codigo/404` aparece uma vez: um `404` não melhora sozinho. E `/codigo/502` aparece **três vezes**: a primeira em ordem com as demais e as outras duas depois, separadas pelas esperas sorteadas (até 500 ms e até 1,000 ms). O resultado é o da terceira tentativa, que também falhou. Três tentativas, duas esperas, e nenhuma a mais.

Quem se perguntar por que a revisão do `502` continua dizendo `"ms":1` depois de quase um segundo e meio de retentativas: `ms` mede a última consulta, não a revisão completa. É o que o serviço levou para responder, que é o que o `revisor` vigia.

### 6.5 O `502` que não diz se a escrita aconteceu

#### 6.5.1 O gateway que perde respostas

A segunda metade da lição trata da cena do início. Para provocá-la à vontade, `pasarela.ts` se coloca na frente do `revisor` e, com o cabeçalho `X-Simular: perder-primera`, deixa passar a primeira requisição de cada cadastro, recebe a resposta do `revisor` e a descarta. Ao cliente responde o que um gateway real responderia se não recebesse uma resposta completa do que está atrás: `502 Bad Gateway` ([RFC 9110, seção 15.6.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.3)), como Problem Details com `about:blank`. Reconhece «a mesma requisição» pela `Idempotency-Key` e, se não traz chave, pelo digest do corpo:

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

Observe o que o gateway registra em seu terminal: «el revisor respondió 201, pero la respuesta se pierde». Essa linha é o que o cliente nunca vê. Do lado dele, um `502` pode significar que a requisição não chegou ao `revisor`, ou que chegou e algo falhou, ou que chegou, foi cumprida e a resposta se perdeu. **O `502` não diz qual**, e não pode dizê-lo: o gateway também nem sempre sabe. O mesmo vale para um `504` e para uma conexão cortada.

O gateway tem um segundo `502`, que não é simulado. Se o `revisor` está desligado ou corta a conexão, o `fetch` do gateway falha, e uma promise que falha sem que ninguém a aguarde faz o Node derrubar o processo inteiro. Por isso `pasar` vem envolvida em `pasarSinCaerse`: captura a falha, anota «el revisor no respondió», responde `502` com outro `detail` (o gateway não recebeu *resposta*, não «uma resposta *completa*») e continua escutando. Isso será visto em 6.5.3. Um gateway que cai junto com o que protege deixa todos os seus clientes sem sequer um erro para ler. E na resposta que sim deixa passar, reenvia entre outros cabeçalhos `content-length`, para que o cliente receba o mesmo tamanho que o `revisor` deu (será visto no `201` de 6.8.4).

#### 6.5.2 O cliente que tenta de novo

`alta-segura.ts` é o script da cena, escrito com cuidado: cadastra um serviço através do gateway e, se recebe `502`, `503` ou `504`, ou se não recebe nenhuma resposta, espera com *jitter* e tenta de novo, até quatro tentativas. Envia sempre `X-Simular: perder-primera`, para que a cena se reproduza à vontade; um gateway real jamais obedece a um interruptor assim vindo da requisição de um cliente: é só do laboratório. Com a opção `--sin-llave` ele se comporta como o script da cena; sem ela, envia uma `Idempotency-Key` que inventa ao iniciar:

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

A linha que importa é a do comentário: **uma chave por intenção, não por tentativa**. A chave é criada uma vez, antes do loop, e todas as retentativas desse cadastro a levam. Se fosse criada dentro do loop, cada retentativa seria uma requisição nova para o `revisor`, que é exatamente o defeito de «O erro a ser observado».

O resto do programa segue a ordem das duas perguntas de 6.3.1, e a cada passo toma uma decisão que se vê em uma execução (6.5.3 e 6.5.4):

- **`intentar`** faz uma requisição e devolve a resposta (código, corpo e `Retry-After`) ou, se nenhuma chegou, a causa: o código do erro de rede que o Node reporta, como `ECONNREFUSED` (ninguém escuta naquela porta), ou `tiempo agotado`. A requisição leva `signal: AbortSignal.timeout(LIMITE_MS)`: se o servidor aceita a conexão e não responde, a tentativa é cortada aos 2,000 ms (a variável `ALTA_LIMITE_MS` a altera, para testar). Sem esse limite, o Node espera 300 s por tentativa. Uma requisição sem resposta é, para quem a enviou, o mesmo caso que o `502`: pode ter chegado ou não. Com a mesma chave, repeti-la não cria outro serviço, desde que o `revisor` ainda se lembre dessa chave (6.7).
- **`reintentable`** responde à primeira pergunta: pode melhorar sozinho? Sem resposta, `502`, `503` e `504`, sim. Um `409` também, mas somente o de `llave-en-curso`, que é reconhecido pelo `type` e não pelo código: a requisição original continua sendo processada e esperar basta. O `409` de `nombre-repetido`, um `422` e qualquer outro `4xx` não melhoram sendo repetidos.
- **As esperas.** Se o servidor disse quanto esperar (`Retry-After`, lido com `segundosDeEspera` de `cliente.ts`, a mesma função e o mesmo teto de 5 s que as revisões usam), obedece-se; se pede mais, não se insiste e diz-se por quê. Se não disse nada, sorteia-se com *jitter*. A linha `if (intento === INTENTOS) break;` vem **antes** da espera, para que depois da última tentativa não se faça ninguém dormir.
- **O final.** Quando o loop acaba, o programa diz por quê (uma linha) e sai com o código correspondente: `0` somente se o cadastro foi feito (um `2xx`); `1` se não foi feito ou não se sabe, seja porque as tentativas se esgotaram, porque o servidor pediu para esperar demais ou porque respondeu algo que repetir não resolve. Um script que chama `alta-segura.ts` para catorze serviços lê esse código e sabe quais precisa revisar.

Comece pela versão sem chave. Esta execução é parte da série de 6.6.4, que antes cadastrou `avisos` (7), `correo` (8) e `agenda` (9); por isso o id que aparece é o 10:

```text
$ node alta-segura.ts nomina2 http://127.0.0.1:18081/codigo/200 --sin-llave; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento sin llave (podría duplicar)
intento 2: 409 {"type":"https://revisor.example/problemas/nombre-repetido","title":"Ya existe un servicio con ese nombre","status":409,"detail":"ya existe un servicio llamado nomina2","instance":"/servicios","existente":"/servicios/10"}
el servidor respondió 409: repetir lo mismo no lo arregla; sin llave no se sabe si lo que ya existe lo creó un intento anterior
(código de salida: 1)
```

A primeira tentativa recebeu `502`. O cliente esperou e tentou de novo, e a segunda tentativa recebeu `409`, «ya existe un servicio llamado nomina2», com `"existente":"/servicios/10"`. O serviço 10 foi criado pela primeira tentativa: a escrita aconteceu, o cliente nunca ficou sabendo, e agora tem em mãos um `409` que não lhe diz se esse serviço é dele. É a cena, completa. Sem a regra do nome único, a segunda tentativa teria criado o serviço 11, idêntico, e ninguém teria recebido nenhum erro. As duas últimas linhas são do programa: não repete o `409` (não melhora esperando), diz que sem chave não sabe se o que já existe foi criado por uma tentativa anterior, e sai com código `1`.

O que um cliente faz com isso, sem chave? **Reconciliar**: reler o estado e decidir. O `409` traz `existente`; o cliente pode pedir `/servicios/10` e comparar com o que queria criar. Se coincide, assume que foi ele. Funciona, pela metade: se um colega criou um serviço igual um segundo antes, o cliente se apropria dele sem saber. A Lição 7 volta a essa ação. A seção seguinte faz o servidor responder à pergunta por quem pergunta.

#### 6.5.3 Quando ninguém responde

Até aqui, cada falha trouxe uma resposta, ainda que fosse um `502`. Faltam dois casos mais feios: o gateway com o `revisor` desligado, e o cliente sem gateway. Os dois são uma forma de «não sei se aconteceu», e `alta-segura.ts` e `pasarela.ts` os têm resolvidos. Com os três programas recém-iniciados, pare o `revisor` com `Ctrl+C` no terminal dele (na execução da lição ele foi parado pelo PID, e por isso o comando não aparece) e peça de novo um cadastro, agora direto ao gateway:

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

O `revisor` já não existe. O gateway respondeu `502` com Problem Details, e em seu `detail` diz o que lhe aconteceu: «no recibió respuesta del revisor». Compare com o `detail` simulado de 6.5.1, «no recibió una respuesta **completa**»: aquele era um `revisor` que sim respondeu e cuja resposta foi descartada; este é um `revisor` que não respondeu. Para o cliente são o mesmo `502`, e outra vez não diz se o cadastro aconteceu. O importante é que o gateway **continua vivo** para respondê-lo: a requisição seguinte é atendida do mesmo jeito.

Agora o cliente. Com o `revisor` ainda desligado, `alta-segura.ts` recebe `502` nas quatro tentativas:

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

Leia linha por linha. As quatro primeiras linhas que começam com `intento` são as quatro respostas, todas `502`. Entre elas, três esperas: até 500, até 1,000 e até 2,000 ms, que são os tetos do backoff para as tentativas 1, 2 e 3 (`250 × 2^n`, com teto de 2,000). **Não há uma quarta espera**, porque depois da tentativa 4 não resta nada a repetir. A linha seguinte diz por que terminou: «se agotaron los 4 intentos sin una respuesta definitiva». E como o cadastro levava chave, acrescenta a saída honesta: «repetir más tarde con la llave … es seguro». Quem ler essa linha (uma pessoa ou um script) tem a chave para tentar de novo quando o `revisor` voltar. Mas não basta rodar `alta-segura.ts` outra vez, porque ele inventaria outra chave: é preciso repetir a mesma requisição com essa chave e os mesmos bytes (6.7.2), por exemplo com `curl … -H 'Idempotency-Key: <la llave del mensaje>' -d '{"nombre":"sin-revisor","url":"http://127.0.0.1:18081/codigo/200"}'`. E a retentativa só está protegida se o servidor ainda se lembrar da chave: dentro da vigência dela (6.7.1) e se não a perdeu em uma reinicialização (6.7.4). Por fim, `(código de salida: 1)`: o programa **não** terminou com sucesso. O `0` fica reservado para um cadastro que foi feito, de modo que um script que chama `alta-segura.ts` em uma lista de catorze serviços pode olhar esse código e saber quais precisa revisar. Em 6.5.4 verá-se que o `1` também cobre um `4xx`.

O pior caso de espera é a soma dos tetos: 500 + 1,000 + 2,000 = 3,500 ms, mais o que as requisições levam. Aqui cada requisição tem um limite de 2,000 ms, então o pior caso completo é de 4 × 2,000 + 3,500 = 11,500 ms; sem esse limite não haveria pior caso, porque um servidor que não responde deixaria o programa esperando 300 s por tentativa. Com a mesma falha, um programa que ainda esperasse depois da quarta tentativa teria somado outros 2,000 ms para não fazer nada.

A variante sem chave termina no mesmo ponto, mas com outra mensagem:

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

As linhas de espera dizem «sin llave (podría duplicar)» em cada tentativa, e o final já não promete nada: «no se sabe si el alta ocurrió». É o mesmo que aconteceu com o script da cena, dito a tempo. Sem chave, o programa não tem como oferecer uma retentativa segura, e não inventa uma.

O último caso é o do cliente sem gateway. Pare também o gateway com `Ctrl+C` no terminal dele (nesta série, como o `revisor`, ele foi parado pelo PID, e por isso a execução não o mostra) e cadastre outro serviço:

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

Agora as tentativas não dizem `502`: dizem «sin respuesta (`ECONNREFUSED`)». Ninguém escuta na porta 18082, então o sistema operacional recusa a conexão antes que viaje um único byte da requisição. É o único caso da lição em que se saberia com certeza que a requisição não chegou, mas `alta-segura.ts` não se apoia nisso: trata qualquer erro de rede como um `502` (pode ter chegado ou não, e com a mesma chave repetir é seguro) e tenta de novo com os mesmos tetos e o mesmo final. Observe o que **não** aparece: o stack trace de erros do Node (`node:internal/modules/run_main…`) com que termina um programa que não capturou seu `fetch`. O programa captura o erro, o traduz para uma linha que uma pessoa entende e devolve o código `1`.

E o terminal do gateway conta o que viu:

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

Nove linhas de «el revisor no respondió»: uma pela requisição do `curl`, quatro pelas tentativas de `sin-revisor` com chave e quatro pelas da variante sem chave. As quatro tentativas de `sin-pasarela` não aparecem porque nunca chegaram a ele. Três programas distintos, três formas de falhar, e nenhum caiu nem deixou o cliente sem uma linha para dizer.

#### 6.5.4 O que ele faz com o que recebe

Até aqui, `alta-segura.ts` decidiu pelo código: `502`, `503`, `504` ou sem resposta, repete-se. Mas o servidor diz mais que um código, e o programa o escuta em cinco lugares. Para vê-los é preciso um `revisor` que responda coisas que o verdadeiro não costuma responder, então esta seção usa duas ferramentas: o modo de manutenção do `revisor` (`PUT /mantenimiento`, visto na Lição 4) e um servidor simulado, `fig06_04.ts`, que escuta na porta 18082, onde estaria o gateway, e responde o que se mandar.

**Um `4xx` não se repete, e sai com 1.** Um endereço que não é `http` nem `https` é um `422`; repetir a requisição idêntica daria o mesmo `422`. Com o gateway e o `revisor` recém-iniciados:

```text
$ node alta-segura.ts invalida ftp://archivos; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 422 {"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"1 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser una dirección http o https","pointer":"#/url"}]}
el servidor respondió 422: repetir lo mismo no lo arregla
(código de salida: 1)
```

A primeira tentativa recebeu um `502` porque o gateway perdeu a resposta (6.5.1); a segunda, com a mesma chave, chegou inteira: `422` `datos-invalidos`. O programa não espera nem tenta uma terceira vez. Diz em uma linha o que aconteceu, «el servidor respondió 422: repetir lo mismo no lo arregla», e sai com `1`. Um `0` aqui diria a um script que o cadastro foi feito.

**`Retry-After` manda, com o mesmo teto das revisões.** Com o `revisor` em manutenção, toda escrita recebe um `503` com `Retry-After: 120`:

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

Leia assim: o primeiro `PUT` ativa a manutenção (`204`) e o último a desativa. No meio, `alta-segura.ts` recebe o `502` simulado e depois o `503` da manutenção. Desta vez não sorteia uma espera: lê `Retry-After: 120`, vê que passa do teto de 5 s e para com a mensagem «el servidor pidió esperar 120 s (Retry-After), más de los 5 s que este programa espera; no se reintenta», mais a chave, caso alguém queira repetir mais tarde. É a mesma regra de 6.4.3, com a mesma função (`segundosDeEspera`) e o mesmo teto.

Para ver o outro lado é preciso um servidor que peça uma espera curta. Aqui entra o servidor simulado:

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

Uma resposta por requisição, e a última se repete. `503:2` é um `503` com `Retry-After: 2`; `409:en-curso` é o `409` da chave em andamento (com seu `type`, que é o que `alta-segura.ts` olha); `mudo` aceita a conexão e não responde. Pare o gateway com `Ctrl+C` (na execução, pelo PID) e inicie o servidor simulado no lugar dele, em outro terminal. Primeiro, um `503` que pede dois segundos e depois um `201`:

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

A linha de espera mudou de forma: «el servidor pide esperar 2 s (Retry-After); espero 2 s y reintento con la misma llave». Já não é um sorteio entre 0 e um teto, é o que o servidor pediu. A segunda tentativa recebe o `201` e o programa sai com `0`. O terminal do servidor simulado confirma que recebeu exatamente duas requisições.

**O `409` de «chave em andamento» não é final.** É o `409` visto em 6.6.4: a requisição original continua sendo gravada. Um cliente que recebe esse `409` não tem nada a corrigir; espera e repete. `alta-segura.ts` o reconhece pelo `type` do Problem Details (não pelo título nem pelo detalhe) e o trata como qualquer falha passageira:

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

O mesmo `409` com outro `type` (o que o `revisor` usa para um nome repetido) não é repetido: repetir não mudaria o nome.

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

Uma única requisição no terminal do servidor simulado, `1` de saída. Dois `409`, duas decisões, e o que as separa é o `type`. Essa é a ideia que a Lição 7 converte em uma tabela.

Quando o `409` de «em andamento» aparece com o `revisor` de verdade? Com o limite de 2,000 ms por padrão, quase nunca: o `revisor` leva 500 ms para gravar, então quando uma tentativa é cortada por tempo, a original já terminou e a retentativa recebe o `201` gravado. Só aparece se o limite for menor que o tempo de gravação. Foi medido baixando o limite para 150 ms com `ALTA_LIMITE_MS=150` e repetindo o cadastro até a retentativa chegar antes de a original terminar, e é preciso repetir várias vezes porque depende de quando cai a espera sorteada. Por isso se testa com o servidor simulado, que responde o que se manda.

**Um servidor que não responde é cortado por tempo.** Cada tentativa leva um limite (2,000 ms por padrão). Com `ALTA_LIMITE_MS=300`, para não esperar tanto na execução:

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

Cada tentativa é cortada aos 300 ms e o programa a conta como «sin respuesta (tiempo agotado: 300 ms)»: é o mesmo caso que o `502` ou a conexão recusada, e é repetido igual. Quatro tentativas, quatro requisições no terminal do servidor, e a saída honesta de sempre. Sem o limite, a primeira tentativa levaria uns 300 s para desistir.

### 6.6 `Idempotency-Key`: um rascunho, não um padrão

#### 6.6.1 O que é e em que estado está

A ideia é antiga e muitas APIs grandes a usam: o cliente inventa um identificador único para cada operação que quer fazer uma única vez, o envia em um cabeçalho, e o servidor se lembra do que respondeu a esse identificador. Se ele chega outra vez, em vez de processar a requisição de novo, repete a resposta que já deu. A documentação da Stripe explica assim: se ocorre um erro de conexão, é possível repetir a requisição sem risco de criar um segundo objeto ou de aplicar a mudança duas vezes.

O grupo de trabalho `httpapi` da IETF tentou padronizar esse cabeçalho como `Idempotency-Key`. A última versão é [`draft-ietf-httpapi-idempotency-key-header-07`](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07), de 15 de outubro de 2025, de Jayadeba Jena e Sanjay Dalal, e **expirou em 18 de abril de 2026 sem ser publicado como RFC**. A página do documento no Datatracker da IETF o marca como «Expired Internet-Draft»: seu estado previsto era Standards Track, mas nenhuma RFC saiu dele. Dito sem rodeios: **`Idempotency-Key` não é um padrão**. É um rascunho expirado que descreve um padrão que muita gente já usava. O próprio rascunho lista em sua seção de implementações a Stripe, a Adyen e a Yandex com um cabeçalho chamado assim, e outros que fazem o mesmo com outro nome (o PayPal usa `PayPal-Request-Id`).

Por que usá-lo, então? Porque o padrão é bom, porque o nome é o que a maioria reconhece, e porque o rascunho escreve com cuidado os casos difíceis. Mas a API precisa **documentá-lo como um comportamento próprio**, não como algo que o HTTP garante. O próprio rascunho pede isso: os recursos que o usam devem publicar sua especificação de idempotência (seção 2.5.2), e um cliente genérico não pode supor que um servidor a respeite (seção 2.5.1). Um cabeçalho que o servidor não conhece é ignorado em silêncio: se `Idempotency-Key` é enviada a uma API que não a implementa, a retentativa duplica do mesmo jeito.

#### 6.6.2 O que o rascunho propõe

O essencial do rascunho, seção por seção, e o que o `revisor` faz com cada coisa:

- **Sintaxe (2.1).** O valor é uma *String* dos campos estruturados do HTTP, ou seja, **vai entre aspas**: `Idempotency-Key: "8e03978e-40d5-43e8-bc93-6894a57f9324"`. O `revisor` simplifica: toma o valor tal como chega, sem remover aspas. Para ele, `alta-avisos-1` e `"alta-avisos-1"` são duas chaves distintas (será visto em 6.7.4). As requisições desta lição enviam a chave sem aspas, como fazem muitas APIs que nasceram antes do rascunho; quem implementar o padrão do zero deve aceitar a forma do rascunho.
- **Unicidade (2.2).** A chave deve ser única e não deve ser reutilizada com outra requisição de corpo distinto. O rascunho recomenda um UUID ou outro identificador aleatório. `alta-segura.ts` usa `randomUUID()`; as requisições de `curl` da lição usam nomes legíveis como `alta-avisos-1` para que as execuções possam ser lidas, e em um cliente real isso não se faria (seção 6.7.5).
- **Vigência (2.3).** O recurso pode fazer as chaves expirarem, e deve publicar essa política. É a seção 6.7.1.
- **Digest (2.4).** Junto com a chave, o servidor pode calcular um digest do corpo (um checksum do corpo completo, de alguns campos, ou uma comparação campo a campo) para saber se a requisição repetida é de fato a mesma. O `revisor` usa SHA-256 sobre o JSON já lido.
- **O que fazer (2.6).** Se a chave é nova, atende-se normalmente. Se já foi atendida e a requisição é a mesma, responde-se o que foi respondido da primeira vez. Se chega enquanto a original continua em andamento, responde-se um conflito.
- **Os erros (2.7).** `422 Unprocessable Content` se a chave é reutilizada com outro corpo; `409 Conflict` se chega enquanto a original continua em andamento; `400` se uma operação exige a chave e ela não vem. Os exemplos do rascunho respondem com Problem Details. O rascunho acrescenta uma regra para o cliente: antes de tentar de novo depois de um desses erros, o cliente precisa corrigir a requisição, **exceto com o `409`**, que não pede correção, mas paciência.

No `revisor` a chave é **opcional**, então não há `400`. Os outros dois casos são os dois tipos novos do catálogo: `llave-reutilizada` (`422`) e `llave-en-curso` (`409`). O `409` da chave é outro `409`, distinto do de `nombre-repetido`, e a Lição 3 já o havia antecipado: os dois são conflitos com o estado atual, mas o da chave se resolve esperando e o do nome, relendo. Por isso têm `type` distinto, e por isso a Lição 7 decide pelo `type`, não pelo código.

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

Quatro funções e um registro. `huella` resume o corpo; `tomarTurno` é a que decide: busca a chave **dentro da credencial** (`${credencial}:${llave}`) e, se não existe, a reserva com seu digest e sem resposta gravada (`grabada: null`), que é o que significa «em andamento». Se existe com outro digest, é `otra-peticion`; se existe sem resposta gravada, `en-curso`; se existe com resposta, `repetir`. `grabar` guarda a resposta quando o cadastro termina bem. `soltar` apaga o registro quando o cadastro falha sem criar nada, para que uma retentativa corrigida possa passar.

E o cadastro, em `servicios.ts`, a usa assim (fragmento; o arquivo completo está em 6.8.1):

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

Onde este bloco está importa tanto quanto o que ele faz. Vem **depois** de `leerJson`, de modo que um corpo que não é JSON, que passa de 16 KiB ou que não é um objeto é rejeitado antes de olhar a chave, como na Lição 5: não há digest possível de algo que não pôde ser lido. E vem **antes** de `validar`, da verificação de destino e da busca do nome, porque a chave precisa ser reservada antes de começar o trabalho que poderia ser duplicado. Se qualquer uma dessas três coisas falha, o cadastro chama `soltar`. Se tudo corre bem, o cadastro monta a resposta, a grava e a envia.

Para que o `409` de «em andamento» possa ser visto, o cadastro espera 500 ms simulados antes de guardar (`GUARDAR_MS`). Em uma API real essa espera é o banco de dados, outra API ou uma fila: o tempo em que a chave está reservada e a resposta ainda não existe.

#### 6.6.4 A mesma chave, três desfechos

Com os três programas recém-iniciados, envie o mesmo cadastro duas vezes com a mesma chave:

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

Duas respostas idênticas, byte a byte: o mesmo `201`, o mesmo `Location: /servicios/7`, a mesma `ETag`. O segundo `POST` não criou nada: o terminal do `revisor` diz isso, `idempotencia: la llave alta-avisos-1 ya se atendió; repito su respuesta`. O cliente que tenta de novo recebe o que teria recebido da primeira vez, e não precisa interpretar nenhum `409`.

Agora a mesma chave com outro corpo, outro nome:

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

`422`, `llave-reutilizada`. O `revisor` não repete a resposta de `avisos` (isso faria o cliente acreditar que `correo` foi criado) nem cria `correo` (a chave já tinha dono). Responde que o cliente usou mal a chave, e o rascunho pede ao cliente que corrija antes de tentar de novo: uma chave nova para uma operação nova.

E duas requisições com a mesma chave quase ao mesmo tempo. A primeira é enviada em segundo plano e a segunda 100 ms depois, enquanto a primeira ainda está nos 500 ms de gravação:

```text
$ ( curl -o /dev/null -w 'primera: %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-correo-1' -d '{"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200"}' & sleep 0.1; curl -w '\nsegunda: %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-correo-1' -d '{"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200"}'; wait )
{"type":"https://revisor.example/problemas/llave-en-curso","title":"Esa Idempotency-Key sigue en curso","status":409,"detail":"la petición original con la llave alta-correo-1 todavía no termina","instance":"/servicios"}

segunda: 409
primera: 201
```

A segunda recebeu `409` `llave-en-curso` e terminou primeiro; a primeira terminou depois com `201`. Se o `revisor` não reservasse a chave ao começar, a segunda não receberia `llave-en-curso`: esperaria seus 500 ms, encontraria o `correo` que a primeira acabou de criar e responderia `409 nombre-repetido`. (Foi medido: dois cadastros sem chave com o mesmo nome, o segundo 100 ms depois, deram `201` e `409`, e ficou um único `correo`; no `revisor`, buscar o nome e criar o serviço acontecem juntos, sem nenhum `await` no meio.) É a dúvida da cena: um `409` que não diz se o serviço é de quem pediu. E em um `POST` sem campo único, como pedir uma revisão, as duas teriam criado algo. Reservar a chave sem nenhum `await` no meio (`tomarTurno`) converte essa dúvida em uma resposta clara: «a requisição original continua em andamento». Um cliente que recebe esse `409` não tem nada a corrigir: espera um pouco e repete, e receberá o `201` gravado. `alta-segura.ts` faz isso (6.5.4).

#### 6.6.5 O cliente que tenta de novo com a mesma chave

Agora sim, a cena com chave. Na mesma série:

```text
$ node alta-segura.ts agenda http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 201 {"id":9,"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
(código de salida: 0)
```

A primeira tentativa recebeu `502`: o `revisor` criou `agenda` (id 9) e o gateway descartou a resposta. A segunda tentativa levava a mesma chave, o `revisor` a reconheceu e repetiu seu `201` com o corpo de `agenda`. Desta vez o gateway o deixou passar porque já tinha visto essa chave. **O cliente recebeu a resposta que havia se perdido**, e não precisou adivinhar nada.

A lista da equipe e os dois terminais confirmam que nada foi duplicado:

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

Um serviço por nome: `avisos` (7), `correo` (8), `agenda` (9) e `nomina2` (10, o da seção 6.5.2, que foi executado nesta mesma série). No terminal do `revisor` há duas linhas de idempotência: a de `alta-avisos-1` e a da chave que `alta-segura.ts` inventou. No do gateway, duas respostas perdidas, a de `agenda` e a de `nomina2`, ambas de um `201`. A escrita ocorreu nos dois casos; a diferença é que com chave o cliente ficou sabendo.

### 6.7 Os limites da chave

Até aqui, a chave parece mágica. Não é, e prometer «repita sem duplicar nada» sem dizer onde a promessa termina é uma forma de mentir. Estas são as fronteiras dela, cada uma com uma execução. Todas são de uma série nova, com os três programas recém-iniciados.

#### 6.7.1 Quanto dura

No `revisor`, uma chave dura **o que dura o processo**: o registro vive em um `Map` em memória, sem expiração, e se perde ao reiniciar. É o mínimo para ensinar, e tem dois problemas em uma API real: a memória cresce a cada cadastro, e uma reinicialização esquece todas as chaves (no final desta seção isso é visto).

O rascunho deixa a duração a cada API, com uma condição: que a publique (seção 2.3). A Stripe, por exemplo, documenta que pode apagar as chaves quando têm ao menos 24 horas, e que se uma chave é reutilizada depois de apagada, a requisição é tratada como nova. Essa é a fronteira que é preciso entender: **depois que a chave expira, a retentativa já não está protegida**. Se um cliente tenta de novo durante horas (uma fila que emperra, um trabalho que é retomado no dia seguinte), precisa tentar dentro da vigência, ou aceitar que pode duplicar. O exercício 3 pede para acrescentar vigência a `idempotencia.ts` e ver o que acontece quando ela expira.

#### 6.7.2 O que acontece se o corpo mudar

«O mesmo corpo» depende de como o digest é calculado. O `revisor` o calcula sobre o JSON **já lido**, com `JSON.stringify(datos)`. Isso tem consequências que convém ver:

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

O primeiro `POST` cria `avisos`. O segundo traz os mesmos dados com espaços por todo lado, e o `revisor` repete o `201`: os espaços se perdem ao ler o JSON, então o digest é o mesmo. O terceiro traz os mesmos dois campos **em outra ordem**, e o `revisor` responde `422`: `JSON.stringify` respeita a ordem em que os campos chegaram, então para o digest é outro corpo. E o quarto acrescenta `"limite_ms":2000`, que é justamente o valor padrão: o serviço resultante seria idêntico, e mesmo assim é `422`.

Está errado? É uma decisão, e é a conservadora. O rascunho aceita várias formas de digest (2.4), e todas têm o mesmo dilema: um digest estrito rejeita requisições que «significam» o mesmo, e um digest frouxo aceita requisições que não são a mesma. O `revisor` prefere rejeitar: um `422` diz ao cliente que algo mudou, e o cliente pode corrigir; aceitar um corpo distinto como se fosse o mesmo esconde o erro (é o segundo defeito de «O erro a ser observado»). A consequência para o cliente é simples: **uma retentativa envia os mesmos bytes da original**, não «um corpo equivalente». `alta-segura.ts` cumpre isso porque monta o corpo uma vez por tentativa com os mesmos dados e na mesma ordem.

#### 6.7.3 O que acontece se o cadastro falha

```text
$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-agenda-1' -d '{"nombre":"agenda","url":"ftp://agenda"}'
{"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"1 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser una dirección http o https","pointer":"#/url"}]}
 [422]

$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-agenda-1' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200"}'
201 /servicios/8
```

O primeiro `POST` com `alta-agenda-1` traz um endereço `ftp` e recebe `422` `datos-invalidos`. O segundo, com a mesma chave e o endereço corrigido, cria o serviço. Se o `revisor` tivesse gravado o `422`, a retentativa corrigida teria recebido outra vez o `422` (ou um `422` de chave reutilizada, porque o corpo mudou): o cliente não teria conseguido corrigir seu erro sem inventar outra chave.

Aqui o `revisor` se afasta de propósito da letra do rascunho. A seção 2.6 diz que, se a requisição é repetida quando a original já terminou, responde-se o resultado da operação anterior, «success or an error». O `revisor` **só grava os sucessos**, e libera a chave quando o cadastro falha sem criar nada: dados impossíveis, destino proibido ou nome repetido. A razão é que esses erros não têm efeito a proteger; não há nada a duplicar. A Stripe vai mais longe que o `revisor` na outra direção: em sua API v1 guarda o código e o corpo da primeira requisição assim que o endpoint começa a executar, incluindo os erros `500`, e deixa de fora apenas dois casos: quando os parâmetros não passam na validação e quando a requisição conflita com outra que está sendo executada; essas duas podem ser repetidas. A coincidência com o `revisor` está nesses dois casos; a diferença, em que o `revisor` também não grava os erros que ocorrem depois, e pode liberar a chave porque seus três erros ocorrem antes de criar qualquer coisa. Se uma API tem operações que falham *pela metade* (cobrou, mas não guardou o recibo), esta política já não basta: é preciso gravar o erro, ou melhor, terminar o trabalho pendente.

#### 6.7.4 O que a chave não cobre

**A resposta gravada não é o estado atual.** Na mesma série, aposente o serviço 7 e repita o cadastro original de `avisos` com sua chave:

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

O `revisor` repetiu fielmente seu `201` com `Location: /servicios/7`, e `/servicios/7` responde `410`. Não é um erro: a chave promete a mesma *resposta*, não que o recurso continue ali. Um cliente que tenta de novo e recebe a resposta gravada sabe que sua operação ocorreu uma vez; o que aconteceu depois com o recurso é outra pergunta, e se responde lendo-o.

**A chave é de quem a envia.** `escritura-b` usa a mesma chave `alta-agenda-1` com o mesmo corpo:

```text
$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-b' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-agenda-1' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200"}'
201 /servicios/9
```

`201`, um serviço novo, o 9, da equipe b. Para o `revisor` não é a mesma chave, porque o registro é por credencial (`${credencial}:${llave}`). É o que a seção de segurança do rascunho pede, e o quadro 6.7.5 explica.

**O texto exato da chave.** A mesma chave entre aspas, como o rascunho a escreve:

```text
$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: "alta-agenda-1"' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200"}'
409 
```

Para o `revisor`, `"alta-agenda-1"` com aspas é outra chave, então o cadastro foi processado como novo e foi detido pela rede de proteção do nome repetido (`409`, sem `Location`). Um cliente que seguisse o rascunho ao pé da letra e um servidor que não remove as aspas não se entendem; por isso o rascunho pede para publicar o formato da chave e validá-lo.

**Uma reinicialização.** O `revisor` é parado e iniciado de novo, e o cadastro de `agenda` é repetido com a chave que já havia funcionado:

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

`201` com o id 7: um `revisor` recém-iniciado não se lembra nem da chave nem do serviço. Neste curso não faz mal, porque tudo se perdeu junto; em uma API real que guarda os serviços em um banco de dados e as chaves em memória, a reinicialização esqueceria as chaves e conservaria os serviços, e a retentativa duplicaria. **As chaves são guardadas onde é guardado o que elas protegem**, e se possível na mesma transação.

E há duas fronteiras que não precisam de execução. A chave **só protege o que o `revisor` faz**: se o cadastro enviasse um e-mail de boas-vindas ou chamasse outra API, a chave do `revisor` não evita que esse e-mail ou essa chamada se repitam, a menos que também sejam protegidos. E a chave **só existe no `POST /servicios`**. Pedir uma revisão, `POST /servicios/{id}/revisiones`, não tem chave neste curso: duas requisições criam duas revisões, como visto em 6.2.2. Os `PUT` e `DELETE` não a necessitam, porque já são idempotentes; a Stripe diz o mesmo de seus `GET` e `DELETE`: enviar uma chave ali não tem efeito.

#### 6.7.5 Quadro de segurança: a chave é de quem a envia

Uma tabela de chaves é, na prática, um cache de respostas: quem apresenta a chave recebe a resposta gravada. Se o `revisor` buscasse a chave sozinha, sem a credencial, qualquer um que adivinhasse a chave de outra equipe receberia o `201` dessa equipe, com o id, o nome e o endereço do serviço. O rascunho adverte isso em sua seção de segurança: uma implementação que aceita chaves de pouca entropia permite que um atacante adivinhe as de outros clientes e leia suas respostas guardadas. E propõe duas defesas. O `revisor` tem a primeira: uma chave composta, que combina a chave do cliente com algo que só o servidor conhece do cliente (aqui, a credencial com que se autenticou). A segunda, um formato fixo e publicado para a chave que é validado antes de processar qualquer coisa, ele a tem pela metade: só exige que não esteja vazia. Uma API real pediria um UUID.

Mais duas coisas. As chaves legíveis das requisições desta lição, como `alta-avisos-1`, existem para que as execuções possam ser lidas: um cliente real usa um UUID aleatório, como `alta-segura.ts`. E a chave não deve conter dados pessoais: a documentação da Stripe pede para não usar e-mails nem identificadores de pessoas, porque a chave termina em logs. No `revisor` também: o terminal registra a chave (`idempotencia: la llave … ya se atendió`), nunca a credencial.

### 6.8 O `revisor` completo

#### 6.8.1 Os arquivos que mudam

Quem tiver a pasta da Lição 5 deve copiá-la como `~/curso-http/fig06_01/`. Já foram vistos completos `idempotencia.ts` (6.6.3), `pasarela.ts` (6.5.1) e `alta-segura.ts` (6.5.2). Estes são os outros quatro que mudam.

`problemas.ts`: dois tipos novos no catálogo, `llave-en-curso` e `llave-reutilizada`.

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

`cliente.ts`: `clasificar` sai de `revisar` para que `revisarConReintentos` possa usá-la com a última consulta, e no final chegam o backoff com *jitter* e as retentativas.

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

`servicios.ts`: o cadastro lê `Idempotency-Key`, reserva a chave, a solta se falhar e grava a resposta se terminar bem; as revisões usam `revisarConReintentos`.

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

`respuestas.ts`: o `413` já não perde a corrida contra um cliente que continua enviando. Nas lições anteriores, quando o corpo passava do teto, o `revisor` respondia `413` com `Connection: close` e o Node destruía a conexão assim que terminava de responder. Se o cliente ainda estava enviando, o que chegava a uma conexão já fechada era respondido com um `RST` do sistema operacional, e esse `RST` pode apagar o `413` antes de o cliente lê-lo ([RFC 9112, seção 9.6](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.6)). O cliente via `EPIPE` ou `ECONNRESET` em vez de um `413`. A mesma seção aconselha fechar em etapas: responder, fechar apenas a escrita (meio fechamento), continuar lendo por um tempo e, só então, fechar de vez. É o que `cerrarConCalma` faz: o Node, ao terminar uma resposta com `Connection: close`, chama `socket.destroySoon()`, que fecha e destrói; nessa conexão troca-se esse método por um que apenas fecha a escrita (`socket.end()`), continua-se lendo e descartando o que chegar (`peticion.resume()`), e um temporizador de 2 segundos destrói a conexão se o cliente não a fechar antes. O `413` sai imediatamente, sem esperar que o cliente termine de enviar.

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

Foi medido isoladamente, contra um `revisor` recém-iniciado, com 400 requisições seguidas de 20,000 bytes enviados em partes (20 pedaços de 1,000 bytes, com `fetch` do Node): sem o fechamento em etapas, 380 deram `413` e 20 falharam (17 com `EPIPE` e 3 com `ECONNRESET`); com ele, 400 de 400. Com corpos grandes, de 3 MiB e de 20 MiB enviados em partes, 100 de 100 deram `413`. Com `Content-Length` de 20,000 bytes e com `curl -T -` deram 400 de 400 em todas as versões: a corrida existia, mas aparece sobretudo quando o cliente envia por pedaços. Um cliente que não fecha o seu lado não retém a conexão: o `revisor` a destrói aos 2 segundos (a conexão passa por `FIN_WAIT_2` e aos 3,5 s já não existe). O arquivo completo está em 6.8.2.

#### 6.8.2 Os arquivos que não mudam

Os demais arquivos são os da Lição 5, sem uma única mudança, exceto dois que vão aqui completos: `respuestas.ts`, que mudou na leitura do corpo (6.8.1), e `laboratorio.ts`, cujo ambiente de testes já não envia corpo em um `205` (uma resposta `205` não leva conteúdo, RFC 9110, seção 15.3.6; sai com `Content-Length: 0` e sem `Transfer-Encoding`, porque o `205` não se delimita sozinho, RFC 9112, seção 6.3). Nenhuma execução desta lição pede um `205`. Vão completos para que o `revisor` possa ser montado a partir desta lição:

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

#### 6.8.3 A execução completa

Com os três programas recém-iniciados em `~/curso-http/fig06_01/`, estas são as requisições da lição em ordem, reunidas: a mesma chave duas vezes, a mesma chave com outro corpo, as duas ao mesmo tempo, o cliente com e sem chave através do gateway, a lista, e uma revisão de `pagos`:

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

A revisão de `pagos` é a mesma da Lição 4, e agora com um motivo: passou por `revisarConReintentos`, o serviço pediu 120 s, e como passa do teto de 5 s, o `revisor` não insistiu e conservou o aviso no detalhe.

#### 6.8.4 O resto continua funcionando

As rejeições de SSRF, as requisições condicionais, a atualização perdida com dois `PUT` simultâneos, a ordem do `PUT`, o esquema da credencial, o método com nome de `Object.prototype`, o teto do corpo, o corpo que não é um objeto, as faixas de SSRF, o limite de consultas em tempo real por credencial, o `502` de um serviço que corta a conexão, a leitura estrita de `Retry-After` e a etiqueta depois de reiniciar: nada disso mudou. Esta é a mesma execução, a seguir. Quase no final o `revisor` é desligado e depois o gateway (`$REV` e `$PAS` são os PID guardados pelo script que iniciou os programas; na máquina local eles seriam parados com `Ctrl+C`). `esperar_puerto` é uma função desse script: espera até 10 s que a porta aceite conexões, em vez de dormir um tempo fixo depois de iniciar um programa, para repetir os casos de 6.5.3 (o gateway que responde `502` e `alta-segura.ts` com as tentativas esgotadas, com e sem gateway); os dois são iniciados de novo, e entre a penúltima e a última requisição o `revisor` é reiniciado outra vez:

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

E os dois terminais da execução completa. O do `revisor` registra método e caminho de cada requisição, as duas linhas de idempotência e as duas inicializações que seguem a primeira (uma por reinício, que aparecem como um segundo e um terceiro «revisor en…»); o do gateway, as duas respostas que perdeu, os cinco «el revisor no respondió» (o `curl` e as quatro tentativas de `sin-revisor`) e sua segunda inicialização:

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

### 6.9 Verificar com um programa

Como na Lição 5, o que pode ser verificado à mão é verificado com um programa. `fig06_03.ts` faz cinco testes contra o cadastro, cada um com nomes e chaves novos, para que possa ser executado quantas vezes se quiser sem reiniciar o `revisor`: a mesma chave duas vezes deixa um único serviço; a mesma chave com outro corpo dá `422` `llave-reutilizada` e não cria nada; a mesma chave enquanto a original continua em andamento dá `409` `llave-en-curso`; um cadastro que falha libera a chave; e duas chaves distintas com o mesmo corpo batem no nome. Esta última não testa a chave, testa a fronteira dela: a chave não converte duas intenções em uma.

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

Cinco de cinco, e o programa sai com código 0 (ou com 1 se algo falhar), de modo que pode ser usado em um script. É outra peça da matriz da Lição 8, que verifica o mesmo junto com os 23 códigos.

### 6.10 Verificar os tipos com `tsc` (opcional)

A partir da pasta do `revisor`, com o comando da seção 0.9 da Lição 0 mais `--allowImportingTsExtensions`:

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

Não imprime nada: não há erros. `fig06_02.ts`, `fig06_03.ts` e `fig06_04.ts` passam pelo mesmo comando a partir da pasta de cima, e também as duas versões quebradas da próxima seção e a solução do exercício 3, cada uma colocada sobre uma cópia do `revisor`.

## O erro a ser observado

### A chave que muda a cada tentativa

O erro mais comum com `Idempotency-Key` é gerar a chave no lugar errado: dentro do loop de retentativas, junto à requisição, em vez de fora, junto à intenção. Parece natural, porque «cada requisição leva sua chave». Para provocá-lo, copie `fig06_01/` como `rota/` e faça `rota/alta-segura.ts` inventar a chave outra vez a cada volta do `for` (a versão completa está em `defectos/llave-por-intento/alta-segura.ts`). A chave passa de `const` a `let`, e é reatribuída ao começar cada tentativa:

```ts
// DEFECTO A PROPÓSITO (lección 6): la llave se vuelve a inventar en cada intento, no una por intención.
let llave = opcion === "--sin-llave" ? undefined : randomUUID();
```

```ts
for (let intento = 1; intento <= INTENTOS && !terminado; intento++) {
  llave = opcion === "--sin-llave" ? undefined : randomUUID();
  const resultado = await intentar();
```

Inicie o laboratório, o `revisor` e o gateway a partir de `rota/` e cadastre `agenda`:

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

Quatro `502` e o cliente desiste convencido de que falhou. A lista diz outra coisa: `agenda` existe, com o id 7. E os terminais contam a história: o `revisor` recebeu quatro cadastros; o primeiro criou `agenda` e os outros três bateram no nome (`409`); o gateway descartou as quatro respostas. Por que as quatro, se o gateway só perde a primeira resposta de cada requisição? Porque reconhece «a mesma requisição» pela chave, e cada tentativa levava uma nova: para ele foram quatro requisições distintas, cada uma em sua primeira vez. Para o `revisor` também: nenhuma chave se repetiu, então nunca houve nada a repetir. **Uma chave por tentativa é o mesmo que não ter chave**, com um agravante: o código parece protegido.

Observe também o que o programa diz de si mesmo. Cada espera anuncia «reintento con la misma llave», e é falso: o texto foi montado no início, quando ainda havia uma única chave. E a última linha, «repetir más tarde con la llave … es seguro», nomeia a chave da quarta tentativa, que não é a que criou `agenda` (essa foi a da primeira, e o `revisor` não a viu de novo). Quem seguir esse conselho não está protegido contra nada. Com uma chave por tentativa, as mensagens verdadeiras da versão correta viram mentiras que ninguém nota, porque a saída parece cuidadosa: a saída de um programa é tão confiável quanto a lógica que a produz, e aqui o código e o texto se contradizem.

Aqui a rede de proteção do nome salvou o `revisor` do duplicado. Um `POST` sem campo único, como pedir uma revisão, teria criado quatro. Os programas de `rota/` devem ser parados ao terminar.

### O digest que ninguém compara

O segundo erro é do lado do servidor: guardar a chave e esquecer o digest. É tentador, porque «se a chave é única, o corpo tem que ser o mesmo». Copie outra vez `fig06_01/` como `rota2/` e apague em `rota2/idempotencia.ts` a comparação do digest (a versão completa está em `defectos/sin-huella/idempotencia.ts`):

```ts
  // DEFECTO A PROPÓSITO (lección 6): no se compara la huella; cualquier cuerpo con esa llave «es el mismo».
```

Inicie os três a partir de `rota2/` e envie os dois cadastros de 6.6.4, o de `avisos` e o de `correo` com a mesma chave:

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

O cadastro de `correo` recebeu `201 Created` com o corpo de `avisos`. Um cliente que só olha o código acredita que `correo` existe, e a lista diz que não. É pior que um erro, porque não se vê: a falha aparece dias depois, quando alguém procura `correo` no painel. O verificador o encontra:

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

Quatro de cinco: o único teste que falha é o que envia outro corpo com a mesma chave. A correção é a de `fig06_01/`: comparar o digest e responder `422` quando não coincide. Os programas de `rota2/` devem ser parados ao terminar.

## O que se costuma fazer de errado

**Tentar de novo tudo.** Um `400`, um `401`, um `404` ou um `422` não melhoram com o tempo: repeti-los só gasta. As duas perguntas de 6.3.1 vêm antes de qualquer retentativa.

**Tentar de novo sem esperar, ou esperando sempre o mesmo.** Sem espera, a retentativa chega quando o servidor continua fora do ar. Com uma espera fixa e sem acaso, todos os clientes chegam juntos. Backoff exponencial com *jitter*, com um teto e um número máximo de tentativas.

**Fechar de repente depois do `413`.** Se o servidor fecha a conexão enquanto o cliente continua enviando, o `RST` pode apagar o `413` e o cliente vê um erro de rede em vez da resposta. Fecha-se em etapas: responde-se, fecha-se a escrita, continua-se lendo por um tempo e depois fecha-se de vez (RFC 9112, seção 9.6).

**Esperar sem limite.** Um `fetch` sem tempo máximo deixa um cliente pendurado por minutos com um servidor que aceita a conexão e não responde. Cada tentativa leva um limite e, se for cortada, é tratada como «sem resposta».

**Sair com sucesso quando não houve.** Um programa que termina com `0` depois de um `422` ou de um `409` diz a quem o chama que o cadastro foi feito. O `0` é só para um cadastro que foi feito.

**Esperar depois da última tentativa.** O tempo é gasto à toa, e o cliente demora mais para saber que falhou. E terminar sem dizer que as tentativas se esgotaram (ou terminar com sucesso) deixa o script que o chama sem saber o que ficou pendente: ao esgotá-las, uma mensagem e um código de saída diferente de zero.

**Tentar de novo em cada camada.** Se o navegador, o gateway, o serviço e a biblioteca do banco de dados tentam de novo três vezes cada um, uma falha se multiplica por dezenas. Tenta-se de novo em um único lugar.

**Ignorar `Retry-After`, ou tomá-lo como sugestão.** Se o servidor pede 120 s e o cliente tenta aos 2, o `429` seguinte é merecido. Se a espera que ele pede é mais longa do que o cliente pode esperar, o honesto é não tentar de novo e dizê-lo, como faz o `revisor`.

**Tentar de novo um `POST` sem chave.** É a cena do início. Se o servidor não oferece chave, o cliente reconcilia (relê o estado) antes de repetir.

**Gerar a chave a cada tentativa.** É «A chave que muda a cada tentativa»: o código parece protegido e não está.

**Guardar a chave sem o digest.** É «O digest que ninguém compara»: um corpo distinto recebe um sucesso que não é dele.

**Guardar a chave sem a credencial.** A tabela de chaves vira um cache que qualquer um pode ler adivinhando chaves (6.7.5).

**Prometer «sem duplicados» sem dizer até quando.** Uma chave expira, perde-se em uma reinicialização se vive em outro lugar que não o do que protege, não cobre os efeitos externos e não cobre outras rotas. Se a documentação de uma API não diz isso, os clientes vão supor que a chave protege mais do que protege.

**Apresentar `Idempotency-Key` como um padrão.** É um rascunho expirado. Use-o, e escreva-o na documentação como o que é.

## Exercícios

Os quatro se corrigem sozinhos: cada um termina com uma execução que diz se a previsão estava certa. Escreva a previsão no [diário de bordo](bitacora.md) **antes** de rodar qualquer coisa. Para o 1 e o 4 é preciso o laboratório, o `revisor` e o gateway de 6.8 recém-iniciados.

### Exercício 1 — Pode ser repetido?

Para cada uma destas seis operações, preveja se é idempotente e o que responde na segunda vez. Depois rode cada uma **duas vezes**, e compare o estado com o esperado:

1. `GET /servicios/1`
2. `PUT /servicios/1` com `If-Match: *` e `{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}`
3. `PUT /mantenimiento` com `admin` e `{"activo":false}`
4. `POST /servicios/1/revisiones`
5. `DELETE /servicios/1`
6. `POST /servicios` com `Idempotency-Key: ejercicio-1` e `{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}`

Dica: para cada uma, imprima o código e, se couber, a `ETag` ou o `Location` com `curl -o /dev/null -w '%{http_code} %header{etag}\n'`.

### Exercício 2 — As esperas de `alta-segura.ts`

Sem rodar nada, responda: se as quatro tentativas de `alta-segura.ts` recebem `502`, quantas vezes ele espera? Qual é o teto de cada espera? Quanto pode demorar, no máximo, para desistir (sem contar o que as requisições levam)? O que imprime no final e com que código sai? Preveja também o que muda se o cadastro for com `--sin-llave`. Depois compare com as execuções de 6.5.3. Por último, diga em uma frase por que `if (intento === INTENTOS) break;` vem **antes** da espera e não depois. Para fechar, preveja o código de saída e o número de requisições que `fig06_04.ts` vê com cada uma destas três respostas e verifique com 6.5.4: `422`, `503:1 201` e `409:en-curso 201`.

### Exercício 3 — A chave que expira

Copie `fig06_01/` como `ej3/` e acrescente a `ej3/idempotencia.ts` uma vigência: guarde em cada registro quando a chave foi reservada e, se passaram mais de `VIGENCIA_MS` milissegundos, trate a chave como nova. Use 5,000 ms por padrão, para poder vê-la expirar, e permita alterá-la ao iniciar com a variável de ambiente `REVISOR_VIGENCIA_MS`.

Para saber se acertou, inicie os três programas a partir de `ej3/` e faça dois experimentos. Primeiro, envie o cadastro de `avisos` com `Idempotency-Key: vence-1` duas vezes seguidas, espere seis segundos e envie-o uma terceira vez: preveja o código de cada uma. Depois, cadastre `agenda` com `Idempotency-Key: vence-2`, aposente-a, espere seis segundos e repita o cadastro com a mesma chave: preveja o código e o id.

### Exercício 4 — Quantas vezes ele chama?

Cadastre três serviços do laboratório, `e-504` (`/codigo/504`), `e-cortar` (`/cortar`) e `e-500` (`/codigo/500`), e peça uma revisão de cada um com `escritura-a`, mais uma de `reportes` (o serviço 5, `/lento/3000` com limite de 1,000 ms) com `admin`. Antes de olhar o terminal do laboratório, preveja quantas vezes cada rota aparece e qual `detalle` cada revisão tem. Espere oito segundos antes de pedir os resultados: por que tanto?

## Soluções

### Solução 1

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

1. **`GET`**: seguro e idempotente. `200` nas duas vezes, a mesma `ETag`: nada mudou.
2. **`PUT` com `*`**: idempotente. `200` nas duas vezes, e o conteúdo fica igual (`"limite_ms":1500`), mas a `ETag` passou de `"1-2-…"` a `"1-3-…"`: o `revisor` sobe a versão a cada escrita. É o que diz 6.2.3: o efeito pedido é o mesmo, e o servidor pode manter sua própria história.
3. **`PUT /mantenimiento`**: idempotente. `204` nas duas vezes; o modo fica desativado.
4. **`POST` de revisão**: **não** idempotente. Duas revisões, `/revisiones/1` e `/revisiones/2`.
5. **`DELETE`**: idempotente. `204` e `410`; o serviço fica aposentado nos dois casos.
6. **`POST` com chave**: o método não é idempotente, mas a chave faz com que repetir esta requisição tenha o mesmo efeito que fazê-la uma vez, enquanto a chave continuar vigente. `201` nas duas vezes, o mesmo `Location`.

Quem errou o 2 caiu na armadilha mais comum: uma resposta igual não prova nada, e uma `ETag` distinta não quebra a idempotência.

### Solução 2

Espera **três vezes**, não quatro: entre uma tentativa e a seguinte há três intervalos, e depois da quarta não resta nada a esperar. Os tetos são `250 × 2^n` com limite de 2,000, para `n` igual a 1, 2 e 3: 500, 1,000 e 2,000 ms. No máximo, leva 3,5 segundos para desistir, somando os tetos; com o limite de 2,000 ms por requisição, 11,5 segundos no total.

No final imprime «se agotaron los 4 intentos sin una respuesta definitiva» e sai com código `1`. Com chave acrescenta «repetir más tarde con la llave … es seguro»; com `--sin-llave`, em vez disso, «no se sabe si el alta ocurrió», porque sem chave não há uma retentativa que possa ser oferecida como segura. E as esperas mudam de texto, de «con la misma llave» para «sin llave (podría duplicar)», mas não de duração: o *jitter* não depende da chave. As duas saídas estão em `agotados.salida.txt`, que é a que 6.5.3 mostra.

A linha vem antes da espera porque quem decide se dorme precisa saber se há algo para o qual acordar. Se viesse depois, o programa dormiria até 2,000 ms a mais para descobrir que já não há tentativas, e um script com catorze cadastros falhos perderia até 28 segundos assim. `revisarConReintentos` resolve o mesmo de outra forma: sua espera fica dentro do corpo do `for`, antes da consulta seguinte, e esse corpo não é executado quando `intento < INTENTOS` deixa de ser verdadeiro.

As três respostas do final, com o servidor simulado: um `422` é um `4xx` que repetir não resolve, então **uma** requisição e código `1`. `503:1 201` pede esperar um segundo (menos que o teto de 5 s): **duas** requisições, a segunda um segundo depois, e código `0`. `409:en-curso 201` é um `409` que sim é repetido, com espera sorteada: **duas** requisições e código `0`. Quem respondeu que o `422` é repetido ou que o `409:en-curso` é final deve rever a tabela de 6.3.2 e o `type` do `409`.

### Solução 3

A versão completa está em `ejercicios/ej3/idempotencia.ts`:

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

O essencial são duas linhas: o registro guarda `desde: Date.now()`, e `tomarTurno` trata como nova uma chave cujo registro tem mais de `VIGENCIA_MS`. A execução:

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

Primeiro experimento: `201`, `201` repetido (dentro da vigência) e, seis segundos depois, `409` `nombre-repetido`. A chave expirou, o `revisor` atendeu o cadastro como novo, e a regra do nome único o deteve. Sem essa regra, teria criado outro `avisos`.

Segundo experimento: `201` com o id 8, a aposentadoria e, seis segundos depois, `201` com o id **9**. A chave tinha expirado e o nome já estava livre, então a retentativa criou um serviço novo. É exatamente a fronteira de 6.7.1: **passada a vigência, uma retentativa já não está protegida**. Dentro dos cinco segundos, a mesma requisição teria recebido o `201` gravado do id 8. Se uma API publica uma vigência de 24 horas, seus clientes precisam saber que uma retentativa do dia seguinte pode duplicar.

### Solução 4

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

`/codigo/504` aparece três vezes: um `504` pode melhorar sozinho e não traz `Retry-After`. `/cortar` aparece três vezes: o laboratório fecha a conexão sem responder, a consulta termina como `respuesta-invalida`, e isso também é repetido (quem consulta não sabe que o serviço está quebrado para sempre). `/codigo/500` aparece **uma vez**: o `revisor` não tenta de novo um `500`. E `/lento/3000` aparece três vezes: cada tentativa se esgota aos 1,000 ms.

Os detalhes são os da última tentativa: `504`, `respuesta inválida`, `500` e `tiempo agotado`. Os oito segundos são por causa de `reportes`: três tentativas de até 1,000 ms cada uma mais duas esperas de até 500 e 1,000 ms, mais o segundo que cada revisão espera na fila, são até cinco segundos e meio. Com quatro, o resultado de `reportes` ainda poderia estar `pendiente`.

## Critérios de sucesso

- [ ] Dá para dizer de memória quais métodos são seguros e quais idempotentes segundo a RFC 9110, e por que `POST` e `PATCH` não são.
- [ ] Um `DELETE` repetido dá `204` e depois `410`, e dá para explicar por que continua sendo idempotente; um `PUT` repetido com o mesmo `If-Match` dá `200` e depois `412`, e ao reler encontra-se a alteração feita.
- [ ] `node fig06_02.ts` mostra as mil retentativas em uma única janela sem *jitter* e distribuídas em cinco com *jitter*.
- [ ] Uma revisão de um serviço que responde `502` chama três vezes o laboratório; uma de `pagos` (`503` com `Retry-After: 120`) e uma de um `404` chamam uma única vez.
- [ ] Dois `POST /servicios` com a mesma `Idempotency-Key` dão o mesmo `201` e o mesmo `Location`, e a lista tem um único serviço; com outro corpo dão `422` `llave-reutilizada`; ao mesmo tempo, `409` `llave-en-curso`.
- [ ] `node alta-segura.ts agenda http://127.0.0.1:18081/codigo/200` dá `502` e depois `201`; com `--sin-llave`, `502` e depois `409` com `existente`.
- [ ] Com um `422`, `alta-segura.ts` faz uma única requisição e sai com `1`; com `503:2 201` no servidor simulado espera 2 s e sai com `0`; com `409:en-curso 201` tenta de novo e sai com `0`, e com `mudo` e `ALTA_LIMITE_MS=300` corta quatro tentativas por tempo e sai com `1`.
- [ ] Com o `revisor` desligado, o gateway responde `502` e continua escutando; `alta-segura.ts` espera três vezes (até 500, 1,000 e 2,000 ms), diz «se agotaron los 4 intentos» e sai com código `1`; sem gateway, suas quatro tentativas dizem `sin respuesta (ECONNREFUSED)` e não há stack trace do Node.
- [ ] Dá para explicar, com uma execução para cada um, quanto dura uma chave no `revisor`, por que os campos em outra ordem dão `422` e por que a resposta gravada pode apontar para um serviço aposentado.
- [ ] Dá para dizer que `Idempotency-Key` é um rascunho expirado da IETF e não um padrão, e o que uma API que o use precisa publicar.
- [ ] `node fig06_03.ts` dá `5 de 5`, e contra `defectos/sin-huella/` dá `4 de 5`.
- [ ] Ao terminar, não resta nenhum programa escutando: `curl -i http://127.0.0.1:18080/`, `curl -i http://127.0.0.1:18081/` e `curl -i http://127.0.0.1:18082/` dão o erro 7.

## Resumo

Responda sem olhar a lição:

1. O que é um método seguro e o que é um idempotente? Quais são, segundo a RFC 9110?
2. O que a idempotência promete e o que não promete? Dê um exemplo de cada coisa com o `revisor`.
3. Quais são as duas perguntas antes de tentar de novo? Por que o `revisor` não tenta de novo um `500`?
4. Qual é o teto da espera da tentativa `n` com base de 250 ms e limite de 2,000? O que o *jitter* completo acrescenta e por quê?
5. O que o `revisor` faz quando um serviço responde `Retry-After: 120`? Por que não espera 5 s e tenta de novo?
6. O que significa um `502` para quem fez um `POST`? O que pode fazer sem chave e o que com chave?
7. Em que estado está `Idempotency-Key` na IETF? Que códigos o rascunho propõe e para qual caso cada um?
8. Por que a chave é criada uma vez por intenção e não uma por tentativa?
9. Nomeie quatro coisas que a chave do `revisor` não cobre.
10. Se as quatro tentativas de `alta-segura.ts` falham, quantas esperas ele faz, o que diz no final e com que código sai? Por que não espera depois da última tentativa?
11. Quando `alta-segura.ts` sai com `0`? O que faz com um `Retry-After` de 2 s e com um de 120 s? O que distingue o `409` que ele repete do que não repete?

## Fontes

Todas foram consultadas em 21 de outubro de 2026.

1. [RFC 9110, *HTTP Semantics*, seção 9.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.1) (junho de 2022, padrão da internet): os métodos seguros, o exemplo do log de acessos e a responsabilidade de quem projeta o URI.
2. [RFC 9110, seção 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2): os métodos idempotentes, a repetição automática após uma falha de comunicação, «though the response might differ», o cliente que não deve tentar de novo métodos não idempotentes, o proxy que não deve fazê-lo e a retentativa de uma retentativa.
3. [RFC 9110, seções 9.3.3, 9.3.4 e 9.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.3): `POST`, `PUT` e `DELETE`.
4. [RFC 9110, seção 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3): `Retry-After`, suas duas formas e seu significado com um `503`.
5. [RFC 9110, seções 15.6.3, 15.6.4 e 15.6.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.3): `502`, `503` e `504`.
6. [RFC 6585, *Additional HTTP Status Codes*, seção 4](https://www.rfc-editor.org/rfc/rfc6585.html#section-4): o `429` e seu `Retry-After`.
7. [RFC 5789, *PATCH Method for HTTP*, seção 2](https://www.rfc-editor.org/rfc/rfc5789.html#section-2): `PATCH` não é nem seguro nem idempotente.
8. [*The Idempotency-Key HTTP Header Field*, draft-ietf-httpapi-idempotency-key-header-07](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07) (J. Jena e S. Dalal, 15 de outubro de 2025, rascunho da IETF, expirado em 18 de abril de 2026): sintaxe (2.1), unicidade (2.2), vigência (2.3), digest (2.4), responsabilidades (2.5), o que fazer (2.6), os erros `400`, `409` e `422` (2.7), implementações (4) e segurança (5).
9. [Datatracker da IETF, página do rascunho](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/): estado «Expired Internet-Draft», grupo de trabalho `httpapi`, revisão 07.
10. [RFC 9651, *Structured Field Values for HTTP*, seção 3.3.3](https://www.rfc-editor.org/rfc/rfc9651.html#section-3.3.3) (setembro de 2024, substitui a RFC 8941 que o rascunho cita): as *Strings*, delimitadas por aspas duplas.
11. [RFC 9562, *Universally Unique IDentifiers (UUIDs)*](https://www.rfc-editor.org/rfc/rfc9562.html) (maio de 2024, substitui a RFC 4122 que o rascunho cita): o formato que o rascunho recomenda para a chave.
12. [Marc Brooker, *Exponential Backoff And Jitter*, AWS Architecture Blog](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) (4 de março de 2015): o *jitter* completo, o «igual» e o «descorrelacionado», comparados.
13. [*Timeouts, retries, and backoff with jitter*, Amazon Builders' Library](https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter) (Marc Brooker, 2019): as retentativas como algo «egoísta», a amplificação de 243 vezes com cinco camadas, tentar de novo em um único ponto, o token bucket para limitar retentativas e a idempotência com tokens do cliente.
14. [Google, *Site Reliability Engineering*, «Addressing Cascading Failures»](https://sre.google/sre-book/addressing-cascading-failures/): backoff exponencial aleatório, limite de retentativas por requisição, orçamento de retentativas e o exemplo de 64 tentativas com três camadas.
15. [Stripe, *Idempotent requests*](https://docs.stripe.com/api/idempotent_requests): uma API que opera o padrão em grande escala: chaves de até 255 caracteres, UUID v4 recomendado, sem dados pessoais, remoção a partir de 24 horas, comparação de parâmetros e resultados que não são guardados quando a validação falha.
16. [Node.js, *Command-line API*, `--unhandled-rejections=mode`](https://nodejs.org/docs/latest-v24.x/api/cli.html): na versão 24, o modo padrão é `throw`: uma promise rejeitada que ninguém captura é lançada como exceção não capturada e o processo termina; é o que aconteceria a um gateway que não captura a falha de seu `fetch` (6.5.1).
17. [MDN, `AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static): devolve um sinal que aborta sozinho quando o tempo se cumpre; o erro é um `TimeoutError`. É o limite por tentativa de `alta-segura.ts` (6.5.2).
18. [RFC 9112, *HTTP/1.1*, seção 9.6](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.6): o fechamento em etapas (meio fechamento, continuar lendo, fechar de vez) e o `RST` que pode apagar a última resposta; é o que `cerrarConCalma` faz em `respuestas.ts`.

### Termos desta lição

| | |
|---|---|
| **método seguro** | o que, por sua semântica, não pede nenhuma mudança de estado no servidor: `GET`, `HEAD`, `OPTIONS`, `TRACE` |
| **método idempotente** | o que, repetido, tem o mesmo efeito buscado que uma única vez: os seguros, `PUT` e `DELETE` |
| **retentativa** | repetir uma requisição que falhou, decidido pelo cliente |
| **backoff exponencial** | esperar o dobro (até um teto) antes de cada retentativa |
| ***jitter* completo** | sortear a espera entre 0 e o teto do backoff, para que os clientes não tentem de novo juntos |
| **amplificação** | a multiplicação da carga quando várias camadas tentam de novo por conta própria |
| **chave de idempotência** | o identificador que o cliente inventa uma vez por operação para que o servidor reconheça suas retentativas |
| **digest** | o resumo do corpo que o servidor guarda com a chave para saber se uma retentativa é a mesma requisição |
| **reconciliar** | reler o estado do servidor para saber se uma operação incerta ocorreu |

---

**Anterior:** [Lição 5 — Problem Details (RFC 9457)](05-problem-details.md) · **Próxima:** [Lição 7 — Quem lê o erro: o cliente do `revisor` e os agentes de IA](07-quien-lee-el-error.md)

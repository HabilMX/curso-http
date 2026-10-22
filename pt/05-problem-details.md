# Lição 5 — Problem Details (RFC 9457)

São 3h20 de uma quinta-feira e o painel da equipe de integrações diz que o serviço `pagos` desapareceu. Não desapareceu: continua no `revisor`, com o mesmo id 2 de sempre. O que aconteceu é mais bobo e mais caro. Há duas semanas alguém escreveu um script que sincroniza a lista de serviços com o painel. Quando o `revisor` responde com um erro, o script lê o corpo e, se encontra as palavras «no existe», apaga o serviço do painel. Esta noite outra pessoa mudou o endereço base do script e tirou uma letra. O `revisor` respondeu `404` com «no existe esa ruta», o script viu «no existe» e apagou os seis serviços do painel, um por um. Enquanto isso, outro script da mesma equipe tenta cadastrar um serviço que já existe, recebe `409` com «ya existe un servicio llamado pagos: /servicios/2», divide o texto nos dois-pontos para extrair o id… e ontem alguém corrigiu a redação dessa mensagem e acrescentou um ponto final. Agora o script busca o serviço `/servicios/2.`, que não existe, e tenta de novo a cada segundo. Ninguém fez nada errado de propósito. Os dois scripts leram frases porque o `revisor` não lhes deu outra coisa para ler.

Esta lição dá ao `revisor` uma única forma de dizer o que deu errado, a que a RFC 9457 define, com uma parte para as máquinas que nunca muda e outra para as pessoas que pode ser redigida como se quiser.

**Tempo:** 90 min, ou 2 × 45 (o corte está entre as seções 5.8 e 5.9)

**O que se constrói:** o handler central de erros do `revisor`, `problemas.ts`: um catálogo com um `type` estável para cada problema e uma única função, `fallar`, pela qual passam todos os erros da API; e um programa que verifica se cada erro é um Problem Details bem formado

**O que se aprende:** `application/problem+json`; os cinco membros `type`, `title`, `status`, `detail` e `instance`, e para que serve cada um; **`type` como identificador estável**; `about:blank` e por que o `title` dele fica em inglês; as extensões e suas regras; o que fazer quando há vários problemas em uma resposta; o registro oficial de tipos da IANA; e o que mudou da RFC 7807 para a RFC 9457

**De onde se parte.** Da [Lição 4](04-capacidad-y-fallas-del-servidor.md), com um `revisor` que já produz todos os códigos de erro do curso: os do ponto de entrada da Lição 2, os de estado da Lição 3 e os de capacidade e falhas da Lição 4. Cada código está bem escolhido e leva seus cabeçalhos. Mas o corpo de cada erro é uma linha de texto escrita à mão no lugar onde ocorre, e cada lugar a escreve de um jeito. Esta lição não muda nenhum código nem nenhum dos cabeçalhos que cada código exige (`Allow`, `WWW-Authenticate`, `Retry-After`, `Accept`): muda o corpo de todos os erros de uma vez, e com ele o `Content-Type`.

**O que esta lição não faz.** Não ensina a decidir o que fazer com um erro do lado do cliente: aqui se projeta o que o `revisor` diz, e a [Lição 7](07-quien-lee-el-error.md) escreve o programa que o lê e decide. Não documenta os tipos em OpenAPI nem os verifica a cada mudança; isso é a [Lição 8](08-contrato-verificable.md). E não publica páginas de documentação nos endereços dos `type`: o curso usa um domínio reservado para exemplos, que não pode ser visitado, e a seção 5.4 explica o que se faria em uma API real.

**Sobre as execuções.** O Linux Mint 22 é o sistema de referência do curso. As saídas desta lição foram obtidas em 21 de outubro de 2026 no macOS com Node 24.14.1 e curl 8.7.1, adicionando `-sS` a cada `curl` porque a saída ia para um arquivo (`-s` desativa o indicador de progresso, `-S` permite ver os erros, e nenhum dos dois altera a resposta). Como na Lição 1, enquanto esta lição era escrita outros testes ocupavam as portas 18080 e 18081, de modo que as execuções foram feitas com uma cópia dos programas idêntica, exceto pelas portas, 18580 e 18581, e nas saídas coladas aqui elas foram reescritas como 18080 e 18081, que são as que devem ser digitadas. Os dois números têm a mesma quantidade de dígitos, portanto nenhum `Content-Length` muda. No terminal do `revisor`, a pasta da máquina foi substituída por `<carpeta>`. Na execução local mudam a data de `Date`, os oito dígitos finais de cada `ETag` (o `revisor` os sorteia ao iniciar) e a referência `urn:uuid:` de cada erro interno, que é nova a cada ocorrência, de propósito (seção 5.8). O `revisor` guarda tudo em memória: para obter o mesmo resultado da lição, inicie-o de novo antes de cada série de requisições. Não foi executado em uma instalação de desktop do Mint, e nada do que se usa depende do macOS. Os programas estão em [`programas/05-problem-details/`](../programas/05-problem-details), no repositório do curso: o `revisor` em `fig05_01/`, o verificador em `fig05_02.ts`, as versões quebradas de «O erro a ser observado» em `defectos/`, a solução do exercício 4 em `ejercicio4/`, a execução do `revisor` da Lição 4 em `antes.salida.txt` e cada execução em seu arquivo `.salida.txt`. Todos passam no `tsc` em modo estrito (seção 5.16).

## Ao terminar, será possível

- Reconhecer um Problem Details pelo `Content-Type` e nomear, sem olhar, seus cinco membros e o que cada um diz.
- Decidir, para um erro novo, se merece um `type` próprio ou se basta `about:blank`, e escrever a entrada dele no catálogo com `type`, `title` e `status`.
- Explicar por que o `type` nunca muda, nem entre ocorrências nem entre idiomas, e por que um cliente não deve decidir lendo `title` nem `detail`.
- Acrescentar uma extensão a um tipo de problema respeitando as regras de nome da RFC 9457, e verificar com uma execução que o `revisor` rejeita uma extensão com nome reservado.
- Responder vários problemas do mesmo tipo em um único corpo, com `errors` e `pointer`, e escolher qual responder quando os problemas são de tipos distintos.
- Rodar um programa que verifique se todos os erros da API são Problem Details bem formados, e interpretar suas falhas em duas versões quebradas de propósito.

## O porquê antes do como

As quatro lições anteriores trataram do código de status, e com razão: é a parte da mensagem que qualquer máquina do caminho entende. Mas o código diz pouco. Um `404` diz «não encontrei o que foi pedido», e no `revisor` isso pode significar que a rota não existe, que o serviço não existe, que o serviço é de outra equipe ou que a revisão não existe. Um `422` diz «entendi, mas não posso cumprir», e não diz qual campo falhou. Um `409` diz «conflita com o estado atual», e não diz com quê. O código manda, e para muitas decisões basta. Para as demais, **o corpo explica**, e a pergunta desta lição é como explica.

Até a Lição 4, o `revisor` explicava com uma linha de texto. Isso tem três custos, e a cena do início mostra todos:

1. **Cada erro tem sua própria forma.** O `422` traz uma linha por campo, separada por quebras de linha; o `409` traz o caminho do serviço existente colado ao final da frase; o `500` traz a referência ao final de outra frase. Um cliente que queira aproveitar essa informação escreve um tradutor diferente para cada erro.
2. **O que uma máquina precisa está misturado com o que uma pessoa lê.** O id do serviço repetido está dentro de uma frase. Para extraí-lo é preciso dividir o texto, e no dia em que alguém melhora a redação, o cliente quebra sem que o código de status tenha mudado.
3. **Não há um nome estável para o problema.** «Não existe o serviço 99» e «não existe essa rota» são dois problemas distintos com o mesmo código, e a única forma de distingui-los é ler a frase. Se amanhã o `revisor` for traduzido para o inglês, todos os clientes que liam frases quebram ao mesmo tempo.

A RFC 9457 resolve as três coisas com um objeto JSON de cinco membros. Um deles, `type`, é um nome para o problema que nunca muda, e é a única coisa de que uma máquina precisa para decidir. Outros dois, `title` e `detail`, são para pessoas, e podem ser redigidos e traduzidos como se quiser. O que uma máquina precisa além do nome —o id do serviço repetido, a lista de campos que falharam— vai em membros próprios, as extensões, nunca dentro de uma frase. E tudo viaja com um tipo de conteúdo próprio, `application/problem+json`, para que qualquer um saiba o que está lendo antes de abri-lo.

A lição tem quatro partes:

1. **O formato** (5.1 a 5.3): o que muda na resposta, o tipo de conteúdo e os cinco membros.
2. **Cada membro a fundo** (5.4 a 5.8): `type` e `about:blank`, `title` e `detail`, `status`, `instance`.
3. **Além dos cinco** (5.9 a 5.12): extensões, vários problemas, o registro da IANA e a história do formato.
4. **O `revisor` completo** (5.13 a 5.16): o handler central, os arquivos, a execução e o programa que o verifica.

## Os conceitos

### 5.1 O mesmo erro, antes e depois

Comece por ver o problema. Estas quatro requisições são ao `revisor` da Lição 4, tal como ele ficou:

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

Cada resposta está correta no que a Lição 4 pedia: bom código, bons cabeçalhos, uma frase clara. Mas convém olhar os corpos como um programa os veria. O primeiro é uma frase com um número dentro. O segundo, outra frase com um método e um caminho dentro. O terceiro, três linhas com um formato próprio, `campo: explicação`, que não aparece em nenhum outro erro. O quarto coloca um caminho no final da frase, depois de dois-pontos. Quatro erros, quatro formas, e todas são `text/plain`: nada na resposta diz ao cliente que há uma estrutura que ele possa aproveitar.

Agora, a mesma primeira requisição ao `revisor` desta lição:

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

Três coisas mudaram. O `Content-Type` já não é `text/plain` e sim `application/problem+json`. Apareceu `Content-Language: es`, que diz em que idioma estão as partes para pessoas. E o corpo é um objeto JSON com cinco membros, sempre os mesmos cinco, em todos os erros que o `revisor` responde. O código e sua frase, `404 Not Found`, não mudaram. **O código continua mandando; o corpo agora explica com uma estrutura que pode ser lida sem interpretar frases.**

O que não mudou também importa. A Lição 4 deixou claro que um erro do servidor não leva stack traces, caminhos da máquina nem segredos, e o formato novo não relaxa nada disso: um Problem Details é uma superfície pública igual ao texto de antes, e a própria RFC 9457 diz isso na seção 5 (seção 5.8 desta lição).

### 5.2 `application/problem+json`: o tipo de conteúdo

A RFC 9457 define o modelo de um problema como um objeto JSON e, quando esse objeto viaja como documento, dá a ele um tipo de conteúdo próprio: `application/problem+json` (seção 3). Está inscrito no registro de tipos de conteúdo da IANA, que hoje remete à RFC 9457: não tem parâmetros obrigatórios, nem opcionais, e para todo o resto se comporta como `application/json`. O sufixo `+json` é uma convenção geral: diz «isto é JSON com um significado particular». Um programa que não conheça o significado pode lê-lo como JSON; um que o conheça sabe, antes de abrir o corpo, que lá dentro há um problema com `type`, `title` e os demais.

Por que `application/json` não basta? Porque o tipo de conteúdo é a primeira coisa que um cliente vê, e com `application/json` ele não consegue distinguir um erro de um recurso. Pense em um cliente genérico que recebe um `404` de uma API que não conhece. Se o tipo é `application/problem+json`, ele sabe que pode procurar `type` e `detail` e exibi-los. Se é `application/json`, pode ser um problema, pode ser uma página de resultados vazia com sua própria forma, pode ser qualquer coisa. A seção «O erro a ser observado» provoca justamente isso: um corpo perfeito com o tipo errado, e o programa que verifica os erros o rejeita nos treze casos.

Existe uma versão em XML, `application/problem+xml`, que a RFC define em seu apêndice B para as APIs que falam XML. O `revisor` fala JSON, então não a usa.

A RFC acrescenta um detalhe que convém conhecer: seu segundo exemplo, o mesmo de `errors` e `pointer` que o `revisor` usa, envia `application/problem+json` embora o cliente tenha pedido apenas `Accept: application/json`, e esclarece que o HTTP permite isso (seção 3, com referência à seção 12.5.1 da RFC 9110). A negociação de conteúdo é uma preferência do cliente, não uma ordem: a RFC 9110 diz em sua seção 12.4.1 que, se nenhuma representação é aceitável segundo um cabeçalho de negociação, o servidor pode responder `406` ou ignorar esse cabeçalho. Para um erro, ignorá-lo é quase sempre o melhor: um `406` no lugar da explicação do erro deixa o cliente sem saber o que falhou. O exercício 3 verifica isso com o `revisor`.

### 5.3 Os cinco membros

Este é o corpo da resposta anterior, em várias linhas para facilitar a leitura (é um fragmento: o `revisor` o envia em uma só):

```json
{
  "type": "https://revisor.example/problemas/servicio-inexistente",
  "title": "El servicio no existe",
  "status": 404,
  "detail": "no existe el servicio 99",
  "instance": "/servicios/99"
}
```

A RFC 9457 define cinco membros na seção 3.1, e esta tabela diz para quem é cada um e qual pergunta responde:

| Membro | Tipo | Para quem | O que responde | Muda entre ocorrências? |
|---|---|---|---|---|
| `type` | texto (um URI) | máquinas | qual problema é? | nunca |
| `title` | texto | pessoas | como se chama esse problema? | não, exceto pelo idioma |
| `status` | número | máquinas que perderam a linha de status | qual código o servidor respondeu? | não no `revisor`, que usa um único código por `type` (a RFC deixa que um `type` admita vários) |
| `detail` | texto | pessoas | o que aconteceu desta vez, e como corrigir? | sim |
| `instance` | texto (um URI) | quem dá suporte | qual ocorrência foi? | sim |

Os cinco são opcionais para a RFC: um problema sem `type` vale como `about:blank` (seção 3.1.1), e os demais podem faltar. **O `revisor` envia sempre os cinco**, na mesma ordem, em todos os erros que ele mesmo responde (o `400` de um método com nome absurdo, como `-X constructor`, é respondido pelo parser do Node antes de o `revisor` vê-lo, e por isso não traz corpo; a seção 5.14 mostra isso). É uma decisão de design, não uma norma: um cliente que sabe que eles sempre estão presentes não precisa escrever o caso em que faltam, e uma verificação automática pode exigi-los (o programa da seção 5.15 faz isso).

A RFC tem uma regra para quem lê que vale a pena aprender cedo: **se um membro traz um tipo que não é o dele, é ignorado**, como se não estivesse (seção 3.1). Um `status` que chega como texto, `"404"`, não é um número, então um cliente que siga a RFC age como se não houvesse `status`. É uma regra pensada para que um cliente não quebre com um servidor descuidado, e é outra razão para o servidor ser cuidadoso: um erro de tipo não gera uma mensagem de erro, gera um membro que desaparece em silêncio.

As cinco seções a seguir tratam de cada membro separadamente.

### 5.4 `type`: o identificador estável

Observe as duas primeiras respostas da execução desta lição. A primeira pede um serviço que não existe; a segunda, o serviço 3, que existe mas é da equipe b, e quem pergunta é da equipe a:

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

As duas têm o **mesmo `type`** e o mesmo `title`. Mudam apenas `detail` e `instance`, e nos dois casos apenas pelo número. É o que a Lição 2 pediu para não delatar quais serviços existem: o `404` que esconde de propósito precisa ser indistinguível do `404` de algo que não existe, e agora a regra alcança também o `type`. Um `type` distinto para «é de outra equipe» seria o mesmo vazamento que um `403`, escrito em outro lugar.

**O `type` é o nome do problema, e é a única coisa com que uma máquina deve decidir.** A RFC diz isso com um **deve**: quem consome um problema tem que usar o `type` como o identificador principal do tipo de problema (seção 3.1.1). Não o `title`, que é traduzido. Não o `detail`, que muda a cada ocorrência. O `type`.

Daí sai a regra que dá nome a esta seção: **um `type` nunca muda.** Não muda de uma ocorrência para outra: o serviço 99 e o serviço 3 dão o mesmo. Não muda entre idiomas: se o `revisor` fosse traduzido para o inglês, `title` e `detail` mudariam, e o `type` continuaria sendo `https://revisor.example/problemas/servicio-inexistente`, com suas palavras em espanhol, porque não é uma palavra, mas um identificador. E não muda entre versões da API: mudar um `type` é uma mudança que quebra todos os clientes que decidiam com ele, igual a mudar uma rota.

**Um `type` é um URI.** A RFC permite qualquer referência de URI, mas recomenda que seja absoluta (seção 3.1.1). Um `type` relativo, como `servicio-inexistente`, seria resolvido contra o endereço da requisição, e a mesma palavra significaria duas coisas distintas conforme onde foi pedida: a RFC dá justamente esse exemplo. O `revisor` usa endereços absolutos sob `https://revisor.example/problemas/`, mais a chave do problema.

**Se um `type` é um endereço `https`, ao visitá-lo deveria haver documentação** para pessoas que explique o problema e como resolvê-lo (seção 3.1.1 e seção 4: «A problem type URI SHOULD resolve to HTML documentation»). Em uma API real, `https://tuapi.example.com/problemas/servicio-inexistente` seria uma página que diz quando ocorre, o que significa cada extensão e o que fazer. O curso usa `revisor.example` porque `.example` é um domínio reservado para a documentação (RFC 6761), que não aponta para nenhuma máquina: assim nenhum exemplo do curso coincide com o domínio de uma empresa real. Na API de cada um, o `type` fica sob um domínio que se controle.

Mais duas regras da RFC sobre os `type` resolvíveis. A primeira: o cliente **não deveria** visitar o `type` automaticamente, exceto para dar informação a quem desenvolve, por exemplo com uma ferramenta de depuração (seção 3.1.1). O `type` se compara, não se baixa: um cliente que pedisse a página a cada erro duplicaria as requisições e dependeria de a documentação estar no ar. A segunda: a RFC permite um `type` que não possa ser visitado, como um URI `tag:`, mas recomenda os resolvíveis, porque se um dia se quiser publicar a documentação e o `type` não era um endereço, será preciso mudá-lo, e mudá-lo quebra todos.

E a pergunta de design desta seção: **quando um problema merece um `type` próprio?** A RFC dá o critério na seção 4: os problemas genéricos, os que poderiam ocorrer com qualquer recurso da web, são expressos melhor apenas com o código. O exemplo dela é um `403` a um `PUT`: um tipo «a escrita não é permitida» não acrescenta nada que o código não diga. Um `type` próprio vale a pena quando o problema é do domínio da API e o cliente precisa distingui-lo de outros com o mesmo código: «o serviço não existe» versus «a revisão não existe» versus «a rota não existe», ou «os dados não podem ser cumpridos» versus «o revisor não se conecta a esse destino», que são os dois `422` do `revisor`.

### 5.5 `about:blank`: o problema que é apenas o seu código

Quatro erros do `revisor` não têm `type` próprio. Estes são dois:

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

Uma rota que não existe e um método que a rota não admite são problemas de HTTP, não do `revisor`: podem acontecer com qualquer API, e o código já diz tudo o que há para dizer (com `Allow`, no caso do `405`). Para isso existe `about:blank`. A RFC o inscreve como o único tipo que o registro traz desde o início, e diz que **um problema `about:blank` não tem mais significado que o do seu código de status** (seção 4.2.1). Os outros dois são o `415`, um corpo que não se declara JSON, e o `413`, um corpo de mais de 16 KiB, que serão vistos na execução da seção 5.14.3: podem chegar a qualquer API, e o código, com seus cabeçalhos, já diz tudo.

`about:blank` é além disso o valor padrão: um problema sem `type` vale como se dissesse `about:blank` (seção 3.1.1 e 4.2.1). O `revisor` o escreve de qualquer maneira, pela regra dos cinco membros.

**Com `about:blank`, o `title` é a frase do código.** A RFC diz que o `title` **deveria** ser a frase recomendada para esse código: `Not Found` para `404`, e assim com todos (seção 4.2.1). Por isso o `revisor` diz `Not Found`, `Method Not Allowed` e `Unsupported Media Type`, em inglês, embora todo o resto esteja em espanhol. A razão é que com `about:blank` não há um tipo próprio que dê nome ao problema: o nome do problema é o código, e o código tem uma frase oficial, a do registro de códigos da IANA, que todo mundo reconhece.

A mesma linha da RFC acrescenta que essa frase **pode** ser traduzida conforme o que o cliente pedir com `Accept-Language`. É uma permissão, não uma obrigação, e o `revisor` não a usa: deixa a frase do registro como está. O que sim vai em espanhol nesses três erros é o `detail`, que explica a ocorrência: «no existe esa ruta», «PATCH no se admite en /servicios/1». É a mesma divisão de sempre: o nome, estável; a explicação, para quem lê.

E não é estranho enviar `Content-Language: es` com um `title` em inglês? A RFC 9110 prevê isso: `Content-Language` descreve o idioma do público a que a representação se destina, e diz que isso «pode não ser equivalente a todos os idiomas usados dentro» dela (seção 8.5). O público do `revisor` lê espanhol; que um nome próprio do HTTP apareça em inglês não muda a quem ele se destina.

Um detalhe de precisão que o `revisor` resolve em `respuestas.ts`: o Node traz os nomes antigos de dois códigos, `413` e `422`, e o registro da IANA tem os novos, `Content Too Large` e `Unprocessable Content`. A linha de status usa os do registro. E o `413` do `revisor` é `about:blank`, então o `title` dele também precisa ser o do registro, `Content Too Large`, e não o `Payload Too Large` que o Node traz: o catálogo o escreve à mão, e o programa da seção 5.15 verifica isso.

### 5.6 `title` e `detail`: o que se traduz

`title` e `detail` são os dois membros para pessoas, e se diferenciam em uma única coisa: **`title` é do tipo e `detail` é da ocorrência.**

O `title` é um resumo curto do tipo de problema. A RFC diz que ele **não deveria** mudar de uma ocorrência para outra, exceto para traduzi-lo (seção 3.1.3). «O serviço não existe» é o mesmo para o serviço 99, para o 3 e para o que se pedir amanhã. Por isso, no `revisor`, o `title` vive no catálogo, junto ao `type`, e não é escrito por quem responde: é escrito por quem projeta o tipo, uma única vez. A RFC acrescenta que o `title` é apenas orientativo, pensado para quem não conhece o significado do `type` e não pode descobri-lo, por exemplo ao ler um log offline.

O `detail` explica **esta** ocorrência: «no existe el servicio 99». A RFC lhe pede duas coisas (seção 3.1.4). A primeira, que se concentre em ajudar o cliente a corrigir o problema, não em dar informação de depuração: «el servicio 5 no respondió en 1000 ms» diz o que aconteceu e sugere o que mudar (o limite do serviço); um stack trace não serve de nada a ele e mostra ao mundo como o servidor é feito. A segunda é uma regra para quem lê: **o cliente não deveria interpretar o `detail` para extrair informação**; para isso existem as extensões, que são «mais adequadas e menos propensas a erros».

Essa segunda regra é a cena do início escrita como norma. O `409` da Lição 4 dizia «ya existe un servicio llamado pagos: /servicios/2», e o script dividia a frase. Compare com o desta lição:

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

O caminho saiu do `detail` e se mudou para seu próprio membro, `existente`. O `detail` já não precisa dele e é uma frase limpa, que pode ser melhorada, encurtada ou traduzida sem quebrar ninguém. O cliente que precisar do serviço existente lê `existente` e obtém `/servicios/2`, sem dividir texto. Essa é a extensão da seção 5.9.

A divisão também permite melhorar os textos sem pedir permissão a ninguém. Imagine que o `title` de `etiqueta-vencida` dissesse «El servicio cambió desde que lo leíste». Seria falso em um caso: depois de uma reinicialização, a etiqueta antiga também não coincide, ainda que ninguém tenha mudado o serviço. Trocá-lo por «Tu etiqueta ya no es la vigente», que é verdadeiro nos dois casos e é o que o `revisor` usa, não quebraria nenhum cliente, porque o `type`, `https://revisor.example/problemas/etiqueta-vencida`, continuaria igual. Um `title` se corrige; um `type` não se toca.

**O que se traduz e o que não**, em uma linha: traduzem-se `title` e `detail`; não se traduzem `type`, `status`, `instance` nem os nomes ou os valores das extensões. O curso tem edições em outros idiomas, mas o código dos programas é copiado sem tradução: o `revisor` de todas as edições responde com o `title` e o `detail` em espanhol, e o `type` é idêntico em todas. Se um `revisor` fosse traduzido, esses dois mudariam e o `type` continuaria igual. Um cliente escrito contra a edição em espanhol funciona igual contra um `revisor` que responda em búlgaro, porque nunca leu uma palavra.

### 5.7 `status`: o código, repetido de propósito

`status` é o código de status, como número, o mesmo da linha de status. Para que repeti-lo? A RFC dá duas razões (seção 3.1.2). Um intermediário, como um cache ou um proxy, pode ter mudado o código no caminho, e o cliente pode ver qual era o original. E um problema pode ser guardado sem sua resposta HTTP —em um log, em uma fila, em um e-mail—, e ali já não há linha de status.

Mas tem uma regra dura: quem gera o problema **deve** usar na resposta HTTP o mesmo código que coloca em `status`. E o membro é apenas orientativo: o software HTTP genérico —proxies, balanceadores, firewalls, antivírus— não o conhece nem o respeita, e continua usando o código da linha de status (seções 3.1.2 e 5). **Se os dois diferem, vence a linha de status para todo aquele que não lê o corpo**, que é quase todo o caminho. É o primeiro princípio do curso dito em um caso concreto: o corpo nunca contradiz o código.

A RFC coloca isso em sua seção de segurança, e vale citá-lo inteiro em ideia: como `status` duplica o que a linha de status já diz, existe a possibilidade de os dois não coincidirem, e não está claro qual tem precedência. Por isso, no `revisor` não há como diferirem: o `status` sai do catálogo junto com o `type`, e a mesma função que escreve o corpo escreve a linha de status com esse número. Quem responde um erro não escolhe o código: escolhe o problema, e o problema traz o seu código.

### 5.8 `instance`: qual ocorrência foi

`instance` é um URI que identifica **esta ocorrência** do problema (seção 3.1.5). A RFC deixa em aberto qual URI usar, e o `revisor` toma duas decisões distintas conforme o caso.

**Nos erros do cliente, `instance` é o caminho que foi pedido, sem a consulta**: `/servicios/99`, `/servicioss`, `/servicios`. Diz a quem lê o problema em um log a qual recurso a requisição se dirigia. A consulta (o que vem depois de `?`) é removida porque nela às vezes viajam dados que não devem ficar copiados em um erro. Atenção: o terminal do `revisor` sim registra a requisição completa, com a consulta; em uma API real, o log também recorta ou mascara o que não deve ser guardado. E é um princípio de design que convém dizer com todas as letras: ele se afasta um pouco da RFC. A RFC define `instance` como o identificador **desta** ocorrência, e diz que, se o URI pode ser visitado, ali deveria ser possível obter o problema (seção 3.1.5). `/servicios/99` pode ser visitado, mas devolve o recurso (ou o mesmo `404`), não esta ocorrência; e duas requisições a `/servicios/99` dão o mesmo `instance`. Ele é usado porque diz a quem lê um log a qual recurso a requisição se dirigia, e a RFC deixa passar na forma: o próprio exemplo dela usa um caminho (`/account/12345/msgs/abc`), e recomenda que um URI relativo leve o caminho completo. Onde sim importa identificar a ocorrência, no `500`, o `revisor` usa uma referência única.

**No erro interno, `instance` é uma referência única**:

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

`urn:uuid:` seguido de um identificador universal único (RFC 9562) é um URI que não pode ser visitado e cuja probabilidade de se repetir é desprezível (122 bits aleatórios: não é impossível, é absurdamente improvável). Cada `500` traz um novo, e o mesmo identificador fica no terminal do `revisor`, junto com o stack trace:

```text
GET /servicios/1/informe
error d80e7ef5-6cf9-4099-83a4-53c6d6116787 en GET /servicios/1/informe: TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:314:28)
    at atender (file://<carpeta>/rutas.ts:107:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:23:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:38:44)
```

Assim trabalha o suporte com um erro do servidor: o cliente relata «recebi o `urn:uuid:…`», e quem opera procura esse texto no log e encontra o stack trace exato, o caminho e a hora. O cliente não recebe o stack trace nem precisa dele. É a mesma referência que a Lição 4 colocava na frase do `500`, agora no membro que a RFC projetou para isso, e com um `detail` que já não a repete: «ocurrió un error inesperado; si se repite, reporta la referencia».

A RFC sugere que, se o `instance` pode ser visitado, ali se possa obter o problema completo (seção 3.1.5), e em sua seção de segurança adverte que quem oferecer essa informação por HTTP evite expor detalhes da implementação, como um dump de stack trace. O `revisor` não oferece essa página: o stack trace vive no terminal, que só quem opera vê.

**Até aqui, a primeira metade.** Para quem trabalha em duas sessões, este é o corte.

### 5.9 Extensões: o que o tipo acrescenta

Um tipo de problema **pode** acrescentar membros próprios ao objeto (seção 3.2). Chamam-se extensões, e são o lugar para tudo o que uma máquina precisa além do nome do problema. O `revisor` tem duas: `existente` no `409`, que já foi vista, e `errors` no `422`, que será vista na seção 5.10.

**Uma extensão pertence ao tipo, não à ocorrência.** Quem a define é quem projeta o tipo, junto com seu `type`, seu `title` e seu `status`, e ela é documentada na página do `type`. `existente` sempre está em um `nombre-repetido`, e sempre é o caminho do serviço que já tem esse nome. Um cliente que conhece o tipo sabe que pode contar com ela.

**O cliente deve ignorar as extensões que não conhece** (seção 3.2). É a regra que deixa os tipos crescerem: se amanhã o `revisor` acrescentar a `nombre-repetido` uma extensão `sugerencia` com um nome livre, os clientes de hoje continuam funcionando, porque não a procuram. Pela mesma razão, remover uma extensão que os clientes usam sim quebra: é como remover um campo de um recurso.

**O nome de uma extensão tem regras.** A RFC diz na seção 4 que o nome **deveria** começar com uma letra, usar somente letras, dígitos e sublinhado, e ter três caracteres ou mais. As duas primeiras regras têm uma razão que a RFC dá: que o nome também possa ser escrito em outros formatos além do JSON, como o XML. A das três letras a RFC pede sem explicar; é uma recomendação (*SHOULD*), não uma obrigação. `existente` e `errors` cumprem. `ex` não cumpriria (tem duas letras) e `nombre-previo` tampouco (tem hífen). O exercício 4 pede para fazer o `problemas.ts` verificar isso.

**E o nome não pode ser o de um membro padrão.** Aqui há uma armadilha do JavaScript. `fallar` monta o corpo com `{ type, title, status, detail, instance, ...extensiones }`: primeiro os cinco e depois as extensões. Se alguém passasse uma extensão chamada `status`, o `...` a escreveria por cima do `status` do catálogo, e o corpo diria um código distinto do da linha de status: o desacordo que a seção 5.7 disse que não podia acontecer. Por isso `fallar` rejeita os cinco nomes reservados antes de montar o corpo, lançando um erro. Esse erro é capturado por `servidor.ts` e convertido em um `500` com sua referência: é um defeito do programa, não do cliente, e assim aparece no terminal em vez de sair como uma resposta que mente.

E os cabeçalhos? `Retry-After` no `503`, `Allow` no `405`, `WWW-Authenticate` no `401` e `Accept` no `415` continuam sendo cabeçalhos, não extensões. A RFC prevê isso: uma definição de tipo pode pedir que a resposta leve `Retry-After` (seção 4). Os cabeçalhos são lidos pelo software HTTP genérico; uma extensão só é lida por quem entende o tipo. O que o HTTP já tem como cabeçalho continua como cabeçalho, e por isso `fallar` recebe os cabeçalhos separados das extensões.

### 5.10 Vários problemas em uma resposta

Uma requisição pode ter mais de um problema. A RFC distingue dois casos, e o `revisor` tem os dois.

**Vários problemas do mesmo tipo: uma extensão com a lista.** Um cadastro com três campos ruins tem três vezes o mesmo problema, «os dados não podem ser cumpridos»:

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

Um único problema `datos-invalidos`, com uma extensão `errors` que lista as três falhas. Cada falha é um objeto com seu `detail`, que explica o que está errado, e um `pointer`, que diz onde. É exatamente a forma do segundo exemplo da seção 3 da RFC 9457, que define um tipo de validação com a extensão `errors` e diz que, quando o tipo é projetado para isso, as extensões podem levar mais de uma ocorrência do mesmo problema. O `detail` de cima apenas conta quantas falhas há: o que o cliente precisa está na lista.

O `pointer` é um **JSON Pointer** (RFC 6901): uma forma padrão de apontar um lugar dentro de um documento JSON. `#/nombre` é o membro `nombre` do objeto raiz; `#/perfil/color` seria o membro `color` dentro de `perfil`; `#/servicios/0` seria o primeiro elemento da lista `servicios`. O `#` na frente é a forma de escrever o ponteiro como fragmento de um URI (seção 6 da RFC 6901), a mesma que o exemplo da RFC 9457 usa. Com isso, um formulário pode colocar cada mensagem junto ao seu campo sem interpretar frases: o `pointer` diz qual, o `detail` diz o quê.

Compare com o `422` da Lição 4: o mesmo conteúdo, três linhas `campo: explicação`. Ali o cliente tinha que dividir o texto por quebras de linha e por dois-pontos, e uma mensagem que contivesse dois-pontos o quebrava. Aqui cada peça está em seu membro.

**Vários problemas de tipos distintos: responde-se o mais relevante.** Agora um cadastro com um nome que já existe e um endereço proibido:

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

`pagos` já existe, então este cadastro tem dois problemas: `nombre-repetido` (`409`) e `destino-prohibido` (`422`). O `revisor` responde apenas o segundo. A RFC diz que, quando uma API encontra vários problemas que não compartilham o tipo, **recomenda-se** responder o mais relevante ou urgente (seção 3). E explica por que não se juntam: embora fosse possível inventar um tipo «lote» que levasse problemas díspares, isso não se encaixa no HTTP. Tem razão pelo código: uma resposta tem um único código de status, e um `409` e um `422` juntos não podem ser expressos com um só.

Qual é o mais relevante? A RFC não decide; quem decide é a API, e no `revisor` quem decide é a ordem em que ele pergunta. Primeiro o ponto de entrada, com as sete perguntas da Lição 2; depois, dentro do cadastro, `validar` reúne todas as falhas de dados; depois `destinoPermitido` verifica o endereço; e no final procura-se um nome repetido. Um endereço proibido é mais urgente que um nome repetido por uma razão prática: se o cliente apenas trocasse o nome, voltaria a bater no endereço; se troca o endereço, pode ser que o nome deixe de importar. O exercício 2 pede para prever outros três empates.

### 5.11 O catálogo e o registro da IANA

O `revisor` tem vinte e dois tipos de problema, cada um com sua chave, seu `type`, seu `title` e seu `status`. Estão em um único lugar, o catálogo de `problemas.ts` (seção 5.13), e essa é metade do valor do formato: em vez de vinte e oito chamadas com sua própria frase espalhadas por cinco arquivos, uma tabela que pode ser lida, revisada e documentada de uma só vez. A Lição 8 a converte na descrição OpenAPI da API.

A RFC 9457 pede que a definição de um tipo novo documente três coisas: o URI do tipo, um `title` curto e o código com que é usado (seção 4). São as três colunas do catálogo. Pode definir também extensões e pedir `Retry-After`, que no `revisor` são `existente`, `errors` e o `503` de manutenção.

Para os tipos que muitas APIs poderiam compartilhar, a RFC 9457 criou um registro oficial na IANA, «HTTP Problem Types» (seção 4.2). Sua política é *Specification Required*: para inscrever um tipo é preciso uma especificação publicada de forma estável e livre, embora não precise ser um padrão. E há uma exclusão que importa aqui: os valores próprios de um fabricante, de uma aplicação ou de uma instalação **não** podem ser inscritos. Os tipos do `revisor` são de sua aplicação, então vivem sob seu próprio domínio e nunca iriam ao registro.

Em 21 de outubro de 2026, o registro tem seis entradas (atualizado pela última vez em 26 de junho de 2026):

| `type` | Nome | Código recomendado | Definido em |
|---|---|---|---|
| `about:blank` | See HTTP Status Code | — | RFC 9457 |
| `…#date` | Date Not Acceptable | `400` | RFC 9458 |
| `…#ohttp-key` | Oblivious HTTP key configuration not acceptable | `400` | RFC 9458 |
| `…#digest-unsupported-algorithms` | Unsupported Hashing Algorithms | `400` | `draft-ietf-httpapi-digest-fields-problem-types`, já aprovado e aguardando seu número de RFC |
| `…#digest-invalid-values` | Invalid Digest Values | `400` | o mesmo documento |
| `…#digest-mismatched-values` | Mismatched Digest Values | `400` | o mesmo documento |

As reticências são `https://iana.org/assignments/http-problem-types`, o prefixo que a RFC permite usar às inscrições, e que adverte que pode não resolver para uma página (seção 4.2). Que o registro seja tão pequeno diz algo: quase todos os problemas são de uma aplicação, e para os genéricos de verdade já existe o código de status com `about:blank`. Antes de inventar um tipo, convém olhar o registro: se houver um que sirva, reutilize-o: para isso o registro existe («to promote reuse», seção 4.2), e é o que o exemplo da seção 4.1 sugere.

### 5.12 Da RFC 7807 à RFC 9457

O formato tem mais história que seu número. Começou como um rascunho individual de Mark Nottingham, datado de 4 de julho de 2012, *Indicating Details of Problems to Machines in HTTP*, com uma advertência incomum na primeira página: que não estava claro se definir o formato melhoraria as coisas o suficiente para compensar o dano que poderia causar, e que usá-lo antes de ser RFC «pode expor ao ridículo». O risco que ele via era o acoplamento: que os clientes dependessem demais dos detalhes de cada API. Publicou-o de qualquer maneira porque, dizia, muita gente já estava fazendo isso do seu jeito.

Foi publicado como **RFC 7807** em março de 2016, por Mark Nottingham e Erik Wilde, e durante sete anos foi a referência. Em julho de 2023 foi substituído pela **RFC 9457**, dos mesmos dois autores e de Sanjay Dalal, também um padrão proposto da IETF, que declara obsoleta a 7807. Seu apêndice D lista as mudanças, e são três:

1. **O registro de tipos** (seção 4.2): a 7807 não tinha um lugar comum para os tipos compartilhados; a 9457 criou o da IANA e inscreveu nele `about:blank`.
2. **O que fazer com vários problemas** (seção 3): a extensão com a lista para os do mesmo tipo, e o mais relevante para os de tipos distintos, com o exemplo de `errors` e `pointer` que o `revisor` usa.
3. **Os `type` que não podem ser visitados** (seção 3.1.1): quando um URI como `tag:` é válido e por que se preferem os resolvíveis.

O que não mudou é quase tudo: os cinco membros, seus tipos, `application/problem+json` e `application/problem+xml`. Um problema escrito segundo a 7807 é válido segundo a 9457, e um cliente da 7807 lê sem mudanças o que o `revisor` envia. Restam vestígios do nome antigo: o namespace do formato XML continua sendo `urn:ietf:rfc:7807`, e o esquema JSON do apêndice A ainda se intitula «An RFC 7807 problem object». Se uma biblioteca disser «RFC 7807», quase sempre produz o mesmo que esta lição; o que lhe falta, se tanto, é o registro e a orientação sobre vários problemas.

### 5.13 O handler central: `problemas.ts`

Tudo o que foi dito cabe em um arquivo novo de sessenta linhas:

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

Leia em três partes.

**O catálogo.** `CATALOGO` é um objeto cujas chaves são os nomes curtos dos problemas (`servicio-inexistente`, `datos-invalidos`…) e cujos valores trazem o `type`, o `title` e o `status`. Os quatro primeiros usam `about:blank` com a frase do registro; os demais, a base `https://revisor.example/problemas/` mais a chave. `satisfies Record<string, Tipo>` pede ao TypeScript que verifique se cada entrada tem os três campos com o tipo correto, sem perder os nomes exatos das chaves. Por isso `Clave`, o tipo da segunda linha depois do catálogo, é a lista exata de chaves: se alguém chamar `fallar(respuesta, "servicio-inexsitente", …)` com uma letra trocada, o `tsc` aponta antes de rodar qualquer coisa.

**`fallar`.** Recebe a resposta, a chave do problema, o `detail` desta ocorrência e algumas opções: cabeçalhos, extensões e `instance`. Tira do catálogo o `type`, o `title` e o `status`, de modo que quem chama **não pode** escrever um `status` diferente do código, nem um `title` diferente do do tipo. Rejeita as extensões com nome reservado (seção 5.9). Calcula `instance` como o caminho pedido sem a consulta, a menos que quem chama envie outro (o `500`). Monta o corpo com os cinco membros primeiro e as extensões depois, e escreve a linha de status com o mesmo `status`, os cabeçalhos de quem chama, o tipo `application/problem+json`, `Content-Language: es` e o comprimento exato em bytes. `Content-Length` é calculado com `Buffer.byteLength` e não com `.length` porque os acentos ocupam dois bytes em UTF-8: «revisión» tem oito letras e nove bytes.

**O que não está lá.** `fallar` não decide nada sobre o problema: não escolhe o código, não escolhe o tipo, não traduz. Apenas converte uma decisão já tomada (a chave) em uma resposta. Essa é a ideia de um handler central: **cada lugar do programa decide qual problema houve, e um único lugar decide como se diz.** Se amanhã o `revisor` tivesse que negociar o idioma, ou enviar `application/problem+xml`, mudar-se-ia este arquivo e nenhum outro.

`respuestas.ts` perde seu `fallar` de texto e exporta `escribirCabecera`, que agora `problemas.ts` também usa para que a frase da linha de status seja a do registro:

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

Nos demais arquivos, cada chamada muda de código para chave, e o que eram cabeçalhos passa para a opção `cabeceras`. Por exemplo, o `405` de `rutas.ts` (fragmento):

```ts
// Lección 4
fallar(respuesta, 405, `${peticion.method} no se admite en ${url.pathname}`, { Allow: permitidos(ruta) });
// Lección 5
fallar(respuesta, "metodo-no-admitido", `${peticion.method} no se admite en ${url.pathname}`, {
  cabeceras: { Allow: permitidos(ruta) },
});
```

Três chamadas mudam algo além da forma, porque a informação de que uma máquina precisa sai da frase. O `409` move o caminho para a extensão `existente`; o `422` troca as linhas pela lista `errors`; e o `500` move a referência para `instance`. Serão vistos completos na seção 5.14.

### 5.14 O `revisor` completo

#### 5.14.1 Os arquivos que mudam

O `revisor` desta lição vive em `~/curso-http/fig05_01/`. Quem tiver a pasta da Lição 4 deve copiá-la com esse nome: além de `problemas.ts` e `respuestas.ts`, que já foram vistos completos, mudam cinco arquivos. Em todos, as chamadas a `fallar` passam de código para chave e o `import` de `fallar` agora vem de `problemas.ts`.

`servidor.ts`: o `500` leva a referência em `instance`.

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

`rutas.ts`: o ponto de entrada, com `about:blank` para a rota e o método, e os tipos próprios da credencial e da permissão.

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

`servicios.ts`: `rechazarDatos` monta a lista `errors`, e os dois `409` levam `existente`.

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

`operacion.ts`: o `503` conserva seu `Retry-After` como cabeçalho; o `403` de quem não é admin usa o mesmo tipo do ponto de entrada.

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

`versiones.ts`: a versão aposentada tem seu próprio tipo, `version-retirada`, distinto de `servicio-retirado`, porque o cliente precisa fazer coisas distintas: em um, parar de pedir esse serviço; no outro, migrar para outra versão da API.

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

#### 5.14.2 Os arquivos que não mudam

Os demais arquivos são os da Lição 4, sem uma única mudança. Vão completos para que o `revisor` possa ser montado a partir desta lição:

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

#### 5.14.3 A execução completa

Abra dois terminais em `~/curso-http/fig05_01/`. No primeiro, o laboratório; no segundo, o `revisor`:

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

Em um terceiro, estas são as requisições da lição, em ordem. As das seções anteriores estão aqui outra vez, reunidas, e depois delas vêm as do 401, o 503 de manutenção, um sucesso, as duas rejeições de SSRF e um corpo grande demais:

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

Observe cinco coisas. O `401` conserva seu `WWW-Authenticate` e o `503` seu `Retry-After`: os cabeçalhos que cada código exige não foram para o corpo. O `413` do final, um cadastro com um nome de 17,000 caracteres, é `about:blank` com a frase do registro, e leva `Connection: close`: o `revisor` deixa de ler assim que o corpo passa de 16 KiB e fecha a conexão ao responder, para não continuar recebendo o que o cliente queria enviar. Os `204` continuam sem corpo. O sucesso, `GET /servicios/1`, continua sendo `application/json`, sem `Content-Language`: o formato é apenas para os erros. E as duas rejeições de SSRF da Lição 1 agora têm seu tipo, `destino-prohibido`, com o mesmo `detail` de sempre, que não enumera os endereços para os quais um nome resolve.

#### 5.14.4 O resto continua funcionando

As requisições condicionais, o esquema da credencial, o método com nome de `Object.prototype`, o corpo que não é um objeto, as faixas de SSRF e a etiqueta depois de reiniciar não mudaram de comportamento: apenas de corpo, quando são erros. Esta é a mesma execução, a seguir. Traz também o caso da atualização perdida com dois `PUT` simultâneos que a Lição 3 mostrou: um lento, que envia o corpo um segundo depois (`curl -T -` o envia em partes), e um rápido com a mesma etiqueta. Entre a penúltima e a última requisição o `revisor` foi reiniciado:

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

Os dois `412` —o da etiqueta fraca e o da requisição lenta, que perdeu a corrida— trazem o mesmo `type` e o mesmo `title`, «Tu etiqueta ya no es la vigente», e apenas o `detail` conta o que aconteceu em cada caso; a mudança que ficou é a da rápida, `"limite_ms":3000`. O `401` do esquema `Basic` já traz seu tipo; o `400` de `null` é `cuerpo-ilegible`; as doze faixas dão `destino-prohibido` com `[422]`. O `400` de `-X constructor` continua sem corpo porque não é o `revisor` que o responde, e sim o Node, antes de chamá-lo, como explicou a Lição 2. A alteração com `text/plain` dá `415` mesmo que traga uma etiqueta antiga ou nenhuma: o formato é perguntado antes da condição, porque a RFC 9110 diz que as pré-condições não são avaliadas se, sem elas, a resposta não teria sido `2xx` nem `412` (seção 13.2.1). Um `PUT` lento a um serviço que outra requisição retira nesse meio-tempo dá `410` `servicio-retirado`, como se tivesse chegado depois da retirada. Os corpos de 20,000 bytes dão `413`, com `Content-Length` ou em partes, e um de exatamente 16,384 é lido sim (e dá `400`, porque não é JSON). A consulta em tempo real tem seu próprio limite, `demasiadas-consultas`, com `Retry-After: 60`, separado do das revisões. O `502` de um serviço que corta a conexão agora diz em seu `title` o que de fato aconteceu: «El servicio no dio una respuesta HTTP válida», verdadeiro tanto se cortou quanto se respondeu algo que não é HTTP. E a etiqueta antiga, depois de reiniciar, dá `200` e não um `304` falso.

O terminal do `revisor`, no final de toda a execução, com as duas referências de erro interno (a da seção 5.8 e a do programa de 5.15):

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

### 5.15 Verificar com um programa

Olhar treze respostas a olho nu para ver se cumprem o formato é tedioso e sujeito a erro. Este programa faz isso: pede treze erros distintos ao `revisor` e verifica em cada um o que dizem as seções anteriores.

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

Para cada caso verifica seis coisas: que o tipo de conteúdo seja `application/problem+json`; que o corpo seja um objeto JSON; que os cinco membros estejam presentes; que `status` seja igual ao código da linha de status; que `type` seja `about:blank` ou um URI absoluto (`URL.canParse` diz se um texto pode ser lido como endereço completo); e que, com `about:blank`, o `title` seja a frase do código. Além disso, mantém a contagem do que viu para cada `type`: se o mesmo `type` aparece duas vezes com `title` ou `status` distintos, ele o marca. Termina com 0 se tudo estiver bem e com 1 se algo falhar, para que possa ser usado em uma verificação automática.

Com o `revisor` em execução, em outro terminal (o programa fica na pasta de cima, `~/curso-http/`):

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

Treze de treze. Este programa é a semente da matriz da Lição 8, que faz o mesmo com os 23 códigos do curso e verifica também os cabeçalhos.

### 5.16 Verificar os tipos com `tsc` (opcional)

A partir da pasta do `revisor`, com o comando da seção 0.9 da Lição 0 mais `--allowImportingTsExtensions`:

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

Não imprime nada: não há erros. `fig05_02.ts` passa pelo mesmo comando junto com os arquivos do `revisor`, e também as duas versões quebradas da próxima seção e a solução do exercício 4. Se uma letra de uma chave for trocada em uma chamada a `fallar`, o `tsc` aponta: é a vantagem de `Clave` ser a lista exata de chaves do catálogo.

## O erro a ser observado

### O `title` que conta a ocorrência

O erro mais comum com este formato é usar `title` como se fosse `detail`: colocar no título a mensagem desta ocorrência. Lê-se de modo muito natural, porque muitas bibliotecas chamam de «mensagem» ou «título» a mesma coisa. Para provocá-lo, copie `fig05_01/` como `rota/` e troque em `rota/problemas.ts` o início de `fallar` por isto (é um fragmento; a versão completa está em `defectos/title-por-ocurrencia/problemas.ts`):

```ts
  // DEFECTO A PROPÓSITO (lección 5): el title lleva el mensaje de esta ocurrencia, como el detail.
  const { type, status } = CATALOGO[clave];
  const title = detail;
```

Inicie o laboratório e o `revisor` a partir de `rota/` e peça os dois serviços da seção 5.4:

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

Cada resposta, sozinha, parece correta: os cinco membros estão lá, o `type` é o de sempre, o código está certo. O problema aparece ao compará-las: o mesmo `type` traz dois `title` distintos, e a RFC diz que o `title` não deveria mudar entre ocorrências. Um cliente que agrupasse seus erros por `title` em um painel veria uma linha para cada serviço que não encontrou, em vez de uma só. E o `title` já não serve para o que existe: dizer a quem lê um log qual *tipo* de problema é. O programa de 5.15 o encontra:

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

Cinco falhas, de duas classes. A primeira é a do `title` que mudou entre o serviço 99 e o 3. As outras quatro são os `about:blank`, cujo `title` já não é a frase do código. E observe o que ele **não** encontrou: oito casos passaram, embora todos tenham o mesmo defeito. O programa só consegue ver que um `title` muda quando o mesmo `type` aparece duas vezes, e na lista dele apenas `servicio-inexistente` se repete. **Uma verificação só vê o que compara.** A correção é voltar ao catálogo: o `title` é do tipo e quem o escreve é quem projeta o tipo, uma única vez. Os programas de `rota/` devem ser parados ao terminar.

### O problema que diz ser JSON

O segundo erro é menor e mais danoso. Copie outra vez `fig05_01/` como `rota2/` e troque em `rota2/problemas.ts` o tipo de conteúdo (a versão completa está em `defectos/json-a-secas/problemas.ts`):

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

O corpo é idêntico, byte a byte, ao da seção 5.1. Apenas uma linha dos cabeçalhos mudou. Mas um cliente genérico que decide «isto é um problema?» olhando o tipo de conteúdo —que é o que a seção 5.2 disse que o tipo próprio permite— agora não o reconhece: para ele é um documento JSON qualquer, talvez a representação de um recurso. O programa o rejeita em todos os casos:

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

Zero de treze, por uma linha. É um defeito comum, porque muitos frameworks colocam `application/json` em tudo o que serializam. A correção é a de `fig05_01/`: o tipo é escrito por `fallar`, em um único lugar, para todos os erros. Os programas de `rota2/` devem ser parados ao terminar.

## O que se costuma fazer de errado

**Decidir com `detail` ou com `title`.** É o que faziam os dois scripts da cena. As frases são corrigidas, encurtadas e traduzidas, e cada mudança quebra o cliente sem que o código nem o `type` tenham mudado. A RFC pede ao cliente que não interprete o `detail`, e lhe dá o `type` para decidir.

**Colocar em uma frase o que uma máquina precisa.** Um id, um caminho, uma quantidade, um campo: se um cliente puder precisar disso, vai em uma extensão com nome próprio. A frase é para pessoas.

**Um `type` por ocorrência.** `…/servicio-inexistente/99`, ou um `type` com a data. Um `type` é o nome de uma classe de problemas; se muda a cada ocorrência, o cliente não consegue compará-lo com nada. O que muda a cada ocorrência vai em `detail` e `instance`.

**Mudar um `type` publicado.** Ainda que a palavra esteja mal escrita, ou já não agrade. Mudá-lo é mudar a API: todos os clientes que decidiam com ele deixam de reconhecer o problema. Se for realmente necessário, trata-se como qualquer mudança de versão, com aviso.

**Um `status` diferente do código, ou como texto.** Diferente, contradiz a linha de status, e quase todo o caminho vai acreditar na linha. Como texto, `"404"`, um cliente que siga a RFC o ignora como se não estivesse lá. No `revisor` as duas coisas são impossíveis porque o `status` sai do catálogo.

**`application/json` nos erros.** O corpo pode estar perfeito, e o cliente genérico não sabe que é um problema. É a seção «O erro a ser observado».

**Usar o formato para depurar.** Stack traces, consultas SQL, nomes de classes, caminhos da máquina no `detail` ou em uma extensão. A RFC diz isso na seção 4: o Problem Details não é uma ferramenta de depuração da implementação, mas uma forma de explicar melhor a interface HTTP. Para depurar existem a referência em `instance` e o log de quem opera.

**Um tipo próprio para o que o código já diz.** Um `type` «método não permitido» ou «não autorizado» não acrescenta nada a um `405` ou a um `401` com seus cabeçalhos. Para isso existe `about:blank`.

**Juntar problemas de tipos distintos em um «lote».** Uma resposta tem um código, e um `409` com um `422` dentro não tem código que os represente. Responde-se o mais relevante; o cliente corrige e tenta de novo.

## Exercícios

Os quatro se corrigem sozinhos: cada um termina com uma execução que diz se a previsão estava certa. Escreva a previsão no [diário de bordo](bitacora.md) **antes** de rodar qualquer coisa. Para os três primeiros é preciso o laboratório e o `revisor` de 5.14 recém-iniciados.

### Exercício 1 — Que problema é?

Sem rodar nada, preveja o código, o `type` e o `title` destas seis respostas, e se alguma traz uma extensão:

```bash
curl -i http://127.0.0.1:18080/revisiones/99 -H 'Authorization: Bearer escritura-a'
curl -i -X DELETE http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200"}'
curl -i http://127.0.0.1:18080/v0/servicios
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{}'
curl -i http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer escritura-a'
```

Dica: as chaves do catálogo de `problemas.ts` são o mapa. Depois rode-as e compare.

### Exercício 2 — Dois problemas ao mesmo tempo

Cada uma destas três requisições tem dois problemas de tipos distintos. Preveja qual dos dois o `revisor` responde, e por que esse:

```bash
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"ftp://pagos"}'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"","url":"http://169.254.169.254/"}'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a' -H 'Content-Type: text/plain' -d 'pagos'
```

A primeira repete um nome e traz um endereço `ftp`; a segunda traz um nome vazio e um endereço proibido; a terceira vem de um leitor e em texto. Rode as três.

### Exercício 3 — O que o cliente pede

Preveja o que o `revisor` responde a estas três requisições. A primeira pede HTML e diz preferir inglês; a segunda pede inglês para uma rota que não existe; a terceira usa `-I`, que envia um `HEAD`:

```bash
curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a' -H 'Accept: text/html' -H 'Accept-Language: en'
curl -i http://127.0.0.1:18080/servicioss -H 'Authorization: Bearer escritura-a' -H 'Accept-Language: en'
curl -I http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
```

Responde `406`? Muda o idioma de alguma coisa? O que o `HEAD` traz? Rode as três e explique cada resposta com a seção da RFC que a permite.

### Exercício 4 — A forma de uma extensão

Copie `fig05_01/` como `ejercicio4/` e acrescente a `fallar`, em `ejercicio4/problemas.ts`, uma verificação da regra de nomes da seção 5.9: um nome de extensão começa com uma letra, usa somente letras, dígitos e `_`, e tem três caracteres ou mais. Se não a cumprir, `fallar` lança um erro, como já faz com os nomes reservados.

Para saber se acertou, faça três coisas. Primeiro, inicie o laboratório e o `revisor` a partir de `ejercicio4/` e rode `node fig05_02.ts`: deve dar treze de treze, porque `existente` e `errors` cumprem a regra. Depois, troque em `ejercicio4/servicios.ts` a extensão `existente: ` do cadastro por `ex: `, reinicie o `revisor` e tente cadastrar `pagos` outra vez. Preveja qual código responde e o que aparece no terminal. Por fim, troque `ex: ` por `status: `, reinicie e repita o cadastro: preveja o que responde e o que diz o terminal.

## Soluções

### Solução 1

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

As seis são tipos próprios do `revisor`, e cada uma diz sua chave no `type`. A revisão que não existe tem seu tipo, `revision-inexistente`, distinto do do serviço: o cliente procura coisas distintas. O leitor que tenta apagar recebe `permiso-insuficiente`, sem extensões, e observe o que o `detail` dele **não** diz: «tu credencial solo puede leer», sem repetir qual. No `revisor` de prática, o nome da credencial é o mesmo texto do *token* que viaja em `Authorization`, e repeti-lo no corpo deixaria o segredo copiado em qualquer log do cliente ou de um intermediário: é o que a seção 5 da RFC pede para revisar em cada `detail`. A alteração sem `If-Match` é `falta-condicion` (`428`), e o `revisor` nem sequer leu o corpo: depois de ver que se declara JSON, a condição é perguntada antes de lê-lo. A versão aposentada não pede credencial e responde `version-retirada` (`410`). O cadastro vazio é `datos-invalidos` com a extensão `errors` e **duas** falhas, não três: `limite_ms` não veio, e seu valor padrão é válido. E a saúde do serviço 5 é `servicio-lento` (`504`), que levou um segundo para chegar porque o `revisor` esperou o limite do serviço antes de desistir.

### Solução 2

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

Nenhuma responde o `409` nem o `422` de destino que talvez se esperasse. A primeira dá `datos-invalidos` com uma única falha, a de `url`: `validar` roda antes da busca do nome repetido, e com um endereço `ftp` o cadastro nem chega a perguntar pelo nome. A segunda também dá `datos-invalidos`, com a falha de `nombre`: `validar` roda antes da verificação do destino, e como o endereço `http://169.254.169.254/` é um endereço `http` válido, `validar` não o marca; quem o verificaria seria `destinoPermitido`, que não chega a rodar. A terceira dá `403` e não `415`: a permissão é a quarta pergunta do ponto de entrada, e o formato é das do handler. Nos três casos, o mais relevante é o que o `revisor` encontra primeiro, e o que ele encontra primeiro é decidido pela ordem em que pergunta. Por isso essa ordem é projetada e documentada.

### Solução 3

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

Nenhuma é `406`, e nada muda de idioma. O `revisor` não negocia o conteúdo de seus erros: ignora `Accept` e `Accept-Language`, e envia `application/problem+json` em espanhol. A RFC 9110 permite isso: se nenhuma representação é aceitável segundo um cabeçalho de negociação, o servidor pode responder `406` ou tratar a resposta como se não houvesse negociação (seção 12.4.1); e a RFC 9457 envia seu segundo exemplo como `application/problem+json` a um cliente que pediu apenas `application/json` (seção 3). Para um erro, é o melhor: o cliente recebe a explicação em vez de outro erro. O `title` de `about:blank` continua em inglês porque assim é sempre no `revisor`, não porque o cliente o pediu; a RFC permitiria traduzi-lo com `Accept-Language`, e o `revisor` decide não fazê-lo (seção 5.5). E o `HEAD` traz os mesmos cabeçalhos do `GET`, com `Content-Length: 174`, mas sem corpo: o Node não o envia em um `HEAD`, e o comprimento diz quanto mediria.

### Solução 4

A verificação, em `ejercicio4/problemas.ts` (fragmento; o arquivo completo está em `ejercicio4/problemas.ts` do repositório):

```ts
  for (const nombre of Object.keys(extensiones)) {
    if (RESERVADOS.has(nombre)) throw new Error(`la extensión ${nombre} usa un nombre reservado`);
    // RFC 9457, sección 4: empieza con letra, solo letras, dígitos y «_», y tres caracteres o más.
    if (!/^[A-Za-z][A-Za-z0-9_]{2,}$/.test(nombre)) throw new Error(`la extensión ${nombre} no cumple la forma del RFC 9457`);
  }
```

A expressão diz: uma letra (`[A-Za-z]`), e depois duas ou mais letras, dígitos ou sublinhados (`[A-Za-z0-9_]{2,}`), e nada mais (`^` e `$`). São letras do alfabeto inglês de propósito: é o que a RFC chama de `ALPHA`, e um `ñ` não é. A execução:

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

Com a regra, o `revisor` continua dando treze de treze, porque suas duas extensões a cumprem. Com `ex`, o cadastro repetido não responde `409` e sim `500`: o nome da extensão é um defeito do programa, não do cliente, e `fallar` se recusa a enviar um corpo que não cumpre o formato. O terminal diz isso com a mesma referência que o cliente recebeu:

```text
POST /servicios
error c0160764-27de-42f7-866a-28ea3f622e08 en POST /servicios: Error: la extensión ex no cumple la forma del RFC 9457
    at fallar (file://<carpeta>/problemas.ts:54:59)
    at Object.darDeAlta [as manejador] (file://<carpeta>/servicios.ts:150:5)
    at async atender (file://<carpeta>/rutas.ts:107:3)
    at async atenderSinFiltrar (file://<carpeta>/servidor.ts:23:5)
```

Com `status` acontece o mesmo, mas pela outra regra: a forma do nome está correta, e é um dos cinco reservados. Sem essa verificação, o `...extensiones` escreveria por cima do `status` do catálogo (seção 5.9). O terminal, depois da segunda reinicialização:

```text
POST /servicios
error 6e53e149-c257-402b-8ea7-2e74df849fb6 en POST /servicios: Error: la extensión status usa un nombre reservado
    at fallar (file://<carpeta>/problemas.ts:52:39)
    at Object.darDeAlta [as manejador] (file://<carpeta>/servicios.ts:150:5)
    at async atender (file://<carpeta>/rutas.ts:107:3)
    at async atenderSinFiltrar (file://<carpeta>/servidor.ts:23:5)
```

Que o defeito saia como `500` e não como uma resposta malformada é a ideia: um erro que se nota no primeiro teste e não no cliente de outra pessoa. Restaure `existente` ao nome original ao terminar.

## Critérios de sucesso

- [ ] Dá para dizer de memória os cinco membros de um Problem Details, para quem é cada um e quais mudam entre ocorrências.
- [ ] `curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'` dá `404` com `Content-Type: application/problem+json`, `Content-Language: es` e `"type":"https://revisor.example/problemas/servicio-inexistente"`; `/servicios/3` dá o mesmo `type` e o mesmo `title`.
- [ ] `/servicioss` dá `"type":"about:blank","title":"Not Found"`, e `PATCH /servicios/1` dá `about:blank`, `Method Not Allowed` e `Allow: GET, HEAD, PUT, DELETE`.
- [ ] Um cadastro com três campos ruins dá `422` com `errors` e três `pointer` (`#/nombre`, `#/url`, `#/limite_ms`); um cadastro com um nome repetido dá `409` com `"existente":"/servicios/2"`.
- [ ] `GET /servicios/1/informe` dá `500` com `instance` `urn:uuid:…`, e essa mesma referência é encontrada no terminal do `revisor`, junto ao stack trace.
- [ ] Dá para explicar por que um cliente decide com `type` e não com `title` nem com `detail`, e por que o `title` de `about:blank` fica em inglês.
- [ ] Uma extensão chamada `status` dá `500`, e o terminal diz `usa un nombre reservado` com a mesma referência que o cliente recebeu.
- [ ] `node fig05_02.ts` dá `13 de 13`, e contra `defectos/json-a-secas/` dá `0 de 13`.
- [ ] Ao terminar, não resta nenhum programa escutando: `curl -i http://127.0.0.1:18080/` dá o erro 7.

## Resumo

Responda sem olhar a lição:

1. Que tipo de conteúdo um Problem Details em JSON leva, e o que o cliente ganha com o fato de não ser `application/json`?
2. Quais são os cinco membros? Qual é o identificador principal do problema, segundo a RFC, e com que verbo ela o diz?
3. O que significa `about:blank`? Que `title` leva e por quê?
4. O que se traduz e o que não se traduz em um Problem Details?
5. Que regra une `status` à linha de status, e por que no `revisor` eles não podem diferir?
6. O que é `instance` em um `404` do `revisor`, e o que é em um `500`? Para que serve a segunda?
7. O que um cliente deve fazer com uma extensão que não conhece? Que regras de nome uma extensão tem?
8. Como se respondem vários problemas do mesmo tipo? E vários de tipos distintos?
9. Que três coisas mudaram da RFC 7807 para a RFC 9457?

## Fontes

Todas foram consultadas em 21 de outubro de 2026.

1. [RFC 9457, *Problem Details for HTTP APIs*](https://www.rfc-editor.org/rfc/rfc9457.html) (julho de 2023, padrão proposto da IETF), seção 3: o objeto, `application/problem+json`, o exemplo de `errors` com `pointer` e a regra de vários problemas.
2. [RFC 9457, seção 3.1](https://www.rfc-editor.org/rfc/rfc9457.html#section-3.1): os cinco membros, a regra de ignorar um membro com o tipo errado, `type` como identificador principal (3.1.1), `status` (3.1.2), `title` (3.1.3), `detail` (3.1.4) e `instance` (3.1.5).
3. [RFC 9457, seção 3.2](https://www.rfc-editor.org/rfc/rfc9457.html#section-3.2): as extensões e a obrigação de ignorar as que não se conhecem.
4. [RFC 9457, seção 4](https://www.rfc-editor.org/rfc/rfc9457.html#section-4): quando definir um tipo, o que documentar, `Retry-After` e as regras de nome das extensões.
5. [RFC 9457, seções 4.2 e 4.2.1](https://www.rfc-editor.org/rfc/rfc9457.html#section-4.2): o registro de tipos e `about:blank`, com o `title` igual à frase do código.
6. [RFC 9457, seção 5 e apêndice D](https://www.rfc-editor.org/rfc/rfc9457.html#section-5): as considerações de segurança e as mudanças em relação à RFC 7807.
7. [IANA, *HTTP Problem Types*](https://www.iana.org/assignments/http-problem-types/http-problem-types.xhtml): o registro oficial, com seis entradas e atualizado em 26 de junho de 2026.
8. [IANA, registro do tipo de conteúdo `application/problem+json`](https://www.iana.org/assignments/media-types/application/problem+json): sem parâmetros, com referência à RFC 9457.
9. [RFC 7807, *Problem Details for HTTP APIs*](https://www.rfc-editor.org/rfc/rfc7807.html) (março de 2016), a versão anterior, hoje obsoleta.
10. [*Indicating Details of Problems to Machines in HTTP*, draft-nottingham-http-problem-00](https://datatracker.ietf.org/doc/draft-nottingham-http-problem/00/) (4 de julho de 2012), o rascunho original e sua advertência.
11. [RFC 9110, *HTTP Semantics*, seções 8.5, 12.1, 12.4.1, 12.5.1, 13.2.1 e 15.5.14](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.5): `Content-Language` e os idiomas de uma representação, a liberdade do servidor de não negociar, por que o `415` vem antes da pré-condição, e o `413`.
12. [RFC 6901, *JavaScript Object Notation (JSON) Pointer*](https://www.rfc-editor.org/rfc/rfc6901.html), seções 3 e 6: a sintaxe de `pointer` e sua forma como fragmento de URI (`#/nombre`).
13. [RFC 9562, *Universally Unique IDentifiers (UUIDs)*](https://www.rfc-editor.org/rfc/rfc9562.html): o identificador da referência `urn:uuid:` dos erros internos.
14. [RFC 6761, *Special-Use Domain Names*](https://www.rfc-editor.org/rfc/rfc6761.html), seção 6.5: `.example`, reservado para a documentação.
15. [IANA, *HTTP Status Codes*](https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml): as frases oficiais dos códigos, que são o `title` de `about:blank`.

### Termos desta lição

| | |
|---|---|
| **Problem Details** | o objeto JSON da RFC 9457 que explica um erro de uma API HTTP |
| **tipo de problema** | uma classe de problemas com nome próprio: o `type`, seu `title`, seu código e suas extensões |
| **ocorrência** | uma vez concreta em que um problema aconteceu; é descrita por `detail` e `instance` |
| **`about:blank`** | o tipo que não acrescenta nada ao código de status; seu `title` é a frase do código |
| **extensão** | um membro próprio de um tipo de problema, além dos cinco padrão |
| **JSON Pointer** | a forma padrão de apontar um lugar dentro de um JSON, como `#/nombre` |
| **catálogo** | a tabela de todos os tipos de problema de uma API |
| **handler central** | a única função pela qual passam todas as respostas de erro |

---

**Anterior:** [Lição 4 — Capacidade e falhas do servidor: 429, 500, 502, 503 e 504](04-capacidad-y-fallas-del-servidor.md) · **Próxima:** [Lição 6 — Retentativas e idempotência](06-reintentos-idempotencia.md)

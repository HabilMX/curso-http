# Lição 8 — O contrato verificável

São 10h05 de uma terça-feira e chega o primeiro aviso da equipe de integrações de outra empresa, a que há três semanas constrói o seu programa contra a API do `revisor`. Dizem que o cliente deles enlouqueceu: tenta de novo a cada cinquenta milissegundos, sem parar, contra o modo de manutenção. Alguém da equipe olha os logs e não encontra nada estranho. O modo de manutenção responde `503`, como sempre. Os testes da equipe passaram ontem à noite, todos em verde, e o painel de disponibilidade está verde. Às 10h20 chega o segundo aviso: o programa deles já não reconhece os erros. Esperava um `application/problem+json` e recebe um `application/json`, então o ramo que lê o `type` não é executado, e cai no que tenta de novo às cegas. Às 10h40, um terceiro: o `503` já não traz `Retry-After`, e o programa deles, sem esse número, usa o que tinha por padrão, que é quase nada.

A causa aparece às 11h, em uma revisão do que foi publicado na segunda-feira. Alguém fez uma “limpeza” do handler central de erros: unificou o tipo de conteúdo de todas as respostas e, de passagem, tirou um cabeçalho que lhe pareceu sobrando. Nenhum dos **códigos** mudou. Um `503` continua sendo um `503`; um `404`, um `404`. E como os testes da equipe só perguntavam pelo código, nenhum notou. O que mudou foi todo o resto que a API prometia nas suas respostas: o tipo de conteúdo, o cabeçalho de espera, a forma como uma máquina decide o que fazer. E essa promessa não estava escrita em nenhum lugar onde um programa pudesse compará-la com a realidade.

Essa promessa é o que esta lição constrói: uma descrição da API em um formato que as máquinas leem (OpenAPI), e uma **matriz** que, com um único comando, faz 23 requisições, olha o que a API realmente responde e compara com o prometido, incluindo os cabeçalhos, o tipo de conteúdo e a forma do corpo. Se alguém voltar a fazer uma limpeza como a de segunda-feira, a matriz fica vermelha na própria segunda, não na terça às 10h05.

**Tempo:** 2 × 45 min (o corte está entre as seções 8.7 e 8.8)

**O que se constrói:** a descrição OpenAPI 3.1 do `revisor` (`openapi.json`), com cada rota, cada erro e cada cabeçalho; a matriz de 23 cenários (`matriz23.ts`) que sobe o servidor, percorre um cenário por código e se desliga sozinha; a mesma matriz escrita com `curl` (`fig08_03.sh`); um programa que cruza o catálogo de tipos de problema com o documento (`fig08_02.ts`); e o fechamento da defesa contra o *DNS rebinding* em `cliente.ts`, com uma simulação que o demonstra (`fig08_04.ts`) e uma contraprova do certificado (`fig08_07.ts`); e os programas com que se mediu uma verificação que falhava às vezes (`fig08_05.ts` para uma condição de corrida de rede, `fig08_06.ts` para o tempo de inicialização de um processo e `fig08_08.sh` para repetir a matriz)

**O que se aprende:** o que é uma descrição OpenAPI e como se lê em cinco peças (`info`, `servers`, `security`, `paths` e `components`); como documentar cada erro com respostas reutilizáveis, o esquema `Problema` e os cabeçalhos que cada código obriga; como conferir que o catálogo de tipos e o documento dizem o mesmo; o que uma matriz verifica e o que não verifica, e como se demonstra que um teste “morde” desfazendo a correção e vendo-o em vermelho; a diferença entre um documento **válido** e um documento **verdadeiro**; o *DNS rebinding* e por que conectar-se ao endereço já validado o fecha; e como se documenta em OpenAPI a retirada anunciada de uma versão

**De onde se parte.** Da [Lição 7](07-quien-lee-el-error.md), com um `revisor` completo nas suas duas faces: como servidor produz os 23 códigos com os seus Problem Details, e como cliente decide, com uma tabela, se segue, corrige, reautentica, espera, reconcilia ou desiste. Da [Lição 5](05-problem-details.md) vem o catálogo de tipos de problema (`problemas.ts`) e o programa de treze verificações que anunciou esta matriz; da [Lição 6](06-reintentos-idempotencia.md), o cabeçalho `Idempotency-Key`, que aqui é documentado com o aviso de que não é um padrão, e o verificador de cinco testes, que a matriz repete; da [Lição 3](03-errores-del-cliente-estado.md), os avisos `Deprecation` e `Sunset` da versão 1; da [Lição 2](02-errores-del-cliente-peticion.md), a decisão de que a forma da API não é um segredo, porque vai estar em um documento que qualquer um pode ler; e da [Lição 1](01-exitos-redirecciones.md), o limite que ficou declarado: o *DNS rebinding*, cuja defesa completa chega hoje.

**O que esta lição não faz.** Não gera clientes nem servidores a partir do documento: o documento é escrito à mão e conferido contra o servidor, o que é uma escolha do curso e não a única possível. Não compara o corpo de cada resposta com o seu esquema JSON campo a campo: a matriz verifica que o código, os cabeçalhos, o tipo de conteúdo e os membros principais do corpo estejam presentes, e o exercício 2 a amplia um passo. Não publica uma página de documentação com o documento (existem visualizadores que fazem isso, e o curso não os usa). Não descreve a autenticação de OAuth nem de outros esquemas: as credenciais do `revisor` são de treino, e o documento as declara como `bearer`. E não promete que uma matriz verde signifique uma API sem defeitos: a seção 8.14 diz o que ela não vê.

**Sobre as execuções.** O Linux Mint 22 é o sistema de referência do curso. As saídas desta lição foram obtidas em 21 de outubro de 2026 no macOS, com Node 24.14.1 (a versão 24 LTS com que todo o curso é executado; existem versões 24.x posteriores, e as saídas são dessa) e curl 8.7.1. O validador de OpenAPI da seção 8.11 é o Redocly CLI 2.57.0 (publicado em 30 de setembro de 2026), instalado com `npm install` em uma pasta à parte, porque é uma ferramenta de revisão e não uma dependência dos programas, que continuam sem nenhuma. O Redocly escreve parte da sua saída na saída de erro e, se houver uma versão nova, imprime um quadro de aviso; por isso as execuções dele levam `2>&1` e a variável `REDOCLY_SUPPRESS_UPDATE_NOTICE=true`, que ocultam só esse quadro. A revisão de tipos usou o TypeScript 7.0.2, como nas lições anteriores. Enquanto esta lição era escrita, outros testes ocupavam as portas do curso, então as séries foram executadas com uma cópia dos programas idêntica exceto pelas portas (cada série com as suas, conferidas como livres antes de rodar), e nas saídas coladas aqui (e nos seus arquivos `.salida.txt`) foram reescritas 18080, 18081 e 18082, que são as que a pessoa vai digitar. São números com a mesma quantidade de dígitos, então nenhum `Content-Length` muda. Na execução de quem acompanha vão mudar a data do `Date`, os oito dígitos finais de cada `ETag`, os milissegundos medidos (`ms`), o tempo que o Redocly mede e os `urn:uuid:` dos erros `500`. Os testes da seção 8.12 que consultam `https://example.com`, `https://expired.badssl.com` e `https://wrong.host.badssl.com` precisam de internet; se a máquina não tiver, pule essa série e as demais seguem iguais. A matriz completa leva uns 16 segundos em um notebook. Rodando a matriz dezenas de vezes seguidas, encontrou-se uma condição de corrida entre o fechamento de uma conexão e o envio de um corpo; a seção 8.14 conta como foi encontrada, como foi medida e como foi fechada, com os números de antes e de depois. Os programas estão em [`programas/08-contrato-verificable/`](../programas/08-contrato-verificable), no repositório do curso: o `revisor` completo em `fig08_01/`, o cruzamento do catálogo em `fig08_02.ts`, a matriz com `curl` em `fig08_03.sh`, a simulação do *DNS rebinding* em `fig08_04.ts`, a contraprova do certificado em `fig08_07.ts`, as medições da seção 8.14.1 em `fig08_05.ts`, `fig08_06.ts` e `fig08_08.sh`, os defeitos propositais em `defectos/`, as soluções dos exercícios em `ejercicios/` e cada execução no seu arquivo `.salida.txt`. Todos passam pelo `tsc` em modo estrito (seção 8.16).

## Ao terminar, será possível

- Ler um documento OpenAPI 3.1 e identificar as suas cinco peças principais, e explicar o que faz uma referência `$ref` e por que as respostas de erro são escritas uma vez e reutilizadas.
- Documentar uma resposta de erro completa: o seu código, o seu tipo de conteúdo `application/problem+json`, o esquema `Problema` e o cabeçalho que esse código obriga (`Allow` em um `405`, `Retry-After` em um `429` e em um `503`, `WWW-Authenticate` em um `401`).
- Rodar um programa que cruza o catálogo de tipos de problema com o documento, e explicar por que hoje ele encontra uma lacuna e como ela se fecha.
- Rodar a matriz de 23 cenários com um único comando, lê-la linha por linha e dizer o que se verifica em cada cenário: código, cabeçalhos, tipo de conteúdo, corpo, vazamentos nos `5xx` e presença no documento.
- Provocar de propósito duas falhas, uma no servidor e outra no documento, e ler a matriz em vermelho; e explicar por que um validador externo pode dizer “válido” diante de um documento que mente.
- Explicar o que é o *DNS rebinding*, por que validar antes de cada conexão não o fecha por completo, e mostrar com uma execução que o cliente da lição chega ao servidor correto enquanto um que usa `fetch` chega ao errado.
- Documentar em OpenAPI a retirada anunciada de uma versão, com `deprecated: true` e os cabeçalhos `Deprecation`, `Sunset` e `Link`.
- Dizer com exemplos medidos o que a matriz não consegue ver, e ampliá-la um passo para que veja.

## O porquê antes do como

Uma API é uma promessa feita a gente que não está na sala. Quem a escreveu conhece o que ela faz; quem a usa conhece só o que lhe foi dito. Entre as duas coisas há um documento, e esse documento tem um defeito de nascença: é de papel. Escreve-se uma vez, lê-se com cuidado uma vez, e a partir desse momento o código muda todos os dias e o documento só muda quando alguém se lembra. Com o tempo, o documento deixa de descrever a API e passa a descrever como a API era quando alguém se lembrou de atualizá-lo.

Há dois remédios, e esta lição junta os dois. O primeiro é que o documento seja **legível por máquinas**: se é um arquivo com estrutura, um programa pode lê-lo, e o que um programa pode ler, um programa pode comparar. O segundo é que essa comparação **rode sozinha**, a cada mudança, com um único comando, e que falhe com uma mensagem que diga que promessa se rompeu. Um documento que é comparado com a realidade todo dia se parece muito com um teste; um teste que é escrito a partir de um documento se parece muito com uma promessa. Daí o nome da lição: um contrato *verificável* é um que pode ser verificado sem pedir permissão a ninguém.

Esta ordem tem uma consequência incômoda, e convém dizê-la de saída: há três lugares onde a mentira pode estar. Pode estar no **servidor**, que mudou e o documento não (a cena do começo). Pode estar no **documento**, que diz algo que o servidor nunca fez. E pode estar no **teste**, que, verde ou vermelho, não olha o que importa. Um validador de OpenAPI só pode dizer se o documento está bem escrito; não sabe nada do servidor. Um teste de códigos só olha os códigos. A matriz desta lição olha os três lugares ao mesmo tempo, e ainda assim tem pontos cegos que a seção 8.14 enumera, porque uma verificação que não diz o que não vê tem o mesmo problema do documento de papel.

A lição tem cinco partes:

1. **O documento** (8.1 a 8.5): o que é OpenAPI, como se lê, como se documentam os erros e como se cruza o catálogo de tipos com o que está escrito.
2. **A matriz** (8.6 a 8.9): como é feita, o que verifica em cada cenário, como se roda e a sua versão com `curl`.
3. **Que o teste morda** (8.10 e 8.11): como se demonstra que uma verificação detecta o que diz detectar, e por que um documento válido não é o mesmo que um documento verdadeiro.
4. **A lacuna que resta da Lição 1** (8.12): o *DNS rebinding* e o seu fechamento.
5. **Versões e limites** (8.13 a 8.16): a retirada anunciada de uma versão no documento, o que a matriz não promete, o `revisor` completo e a revisão de tipos.

## Os conceitos

### 8.1 O `revisor` desta lição

#### 8.1.1 O que muda

O `revisor` da Lição 7 ganha dois arquivos novos, `matriz23.ts` e `openapi.json`, e muda três: `cliente.ts`, `destinos.ts` e `respuestas.ts`. Todo o resto é o das lições anteriores na sua versão vigente, e as rotas, os códigos, os cabeçalhos e os nomes dos campos não mudam.

- **`openapi.json`** (novo) é a descrição da API em OpenAPI 3.1.1: cada rota, cada método, cada resposta (sucessos e erros), os esquemas dos corpos e os cabeçalhos. É o centro das seções 8.3 a 8.5.
- **`matriz23.ts`** (novo) sobe o laboratório e o `revisor`, percorre 23 cenários (um por código do curso) e dezoito verificações adicionais, e os desliga. Em vez de esperar um tempo fixo depois de subir cada processo, espera que a porta aceite conexões, e se alguma porta já estiver ocupada não mede nada e avisa. Sai com código `0` se tudo passou e com `1` se algo falhou (`2` se não pôde começar porque uma porta estava ocupada). É o centro das seções 8.6 a 8.10.
- **`cliente.ts`** muda em `consultar` e ganha duas funções de apoio, `soloA` e `pedir`: em vez de `fetch`, usa `http.request` ou `https.request` e se conecta ao endereço que `destinos.ts` já validou. É a seção 8.12.
- **`respuestas.ts`** muda em uma única função: quando o corpo passa do limite, o `413` sai de imediato e a conexão é fechada **por etapas** (primeiro só a escrita; o servidor continua lendo e descartando o que chegar, e destrói a conexão aos 2 segundos). É a história da seção 8.14.1.
- **`destinos.ts`** muda uma coisa: `revisarDestino` agora devolve, junto com o “sim”, os endereços que validou (`{ permitido: true, direcciones }`), para que quem se conectar use um desses e não volte a perguntar ao DNS.

Os desfechos de `consultar` não mudam: continua havendo os mesmos cinco tipos de resultado (resposta, tempo esgotado, sem conexão, resposta inválida e destino proibido), a mesma classificação em `ARRIBA`, `LENTO` e `CAIDO`, e os mesmos códigos em cada resposta do servidor. Por isso `revisar.ts`, `tabla23.ts` e `por-type.ts`, os três programas da Lição 7, dão o mesmo que antes.

#### 8.1.2 Montar a pasta e conferir que roda

O `revisor` vive em `~/curso-http/fig08_01/`; a seção 8.15 traz todos os seus arquivos. Com o Node 24 instalado, e a partir dessa pasta, uma única linha confere que tudo está no lugar:

```text
$ cd ~/curso-http/fig08_01
$ node matriz23.ts
```

A matriz sobe sozinha o laboratório e o `revisor`, então não é preciso abrir terminais à parte. O que ela precisa é que as portas 18080, 18081 e 18082 estejam livres. Se alguma estiver ocupada, a matriz avisa e sai com `2` sem medir nada; a causa mais comum é um `revisor` de uma lição anterior que ficou aberto: pare esse programa com `Ctrl+C` e comece de novo. A seção 8.7 roda a matriz e lê a saída dela linha por linha.

### 8.2 Um contrato que se pode conferir

#### 8.2.1 O que uma resposta promete

Antes de abrir o documento convém contar o que promete uma resposta, porque o documento tem que dizer tudo e o teste tem que conferir tudo. Uma resposta HTTP promete quatro coisas:

1. **O código de status.** É a primeira coisa que qualquer máquina do caminho lê. É o que a Lição 0 chamou de “o código manda”.
2. **Os cabeçalhos que esse código obriga ou que o desenho decidiu.** Um `405` obriga a mandar `Allow` (RFC 9110, seção 15.5.6: “The origin server MUST generate an Allow header field in a 405 response”). Um `401` leva `WWW-Authenticate`. Um `201` leva `Location` e, nesta API, `ETag`. Um `429` ou um `503` levam `Retry-After`, que a seção 15.6.4 do mesmo RFC permite no `503` com um “MAY”. Essa diferença importa: o que o RFC deixa opcional, esta API decidiu mandar em cada resposta que o permite, e promete no seu documento.
3. **O tipo de conteúdo.** Um erro é `application/problem+json`; um sucesso com corpo é `application/json`; um `204` e um `304` não levam corpo. O tipo de conteúdo é o que diz a um programa como ler o que vem a seguir.
4. **A forma do corpo.** Em um Problem Details, os cinco membros (`type`, `title`, `status`, `detail`, `instance`) e, conforme o tipo, extensões como `errors` ou `existente`.

A cena do começo rompeu duas das quatro (o cabeçalho e o tipo de conteúdo) e deixou intacta a primeira, que era a única que alguém verificava. É um padrão comum: testa-se o que é fácil de testar, e o código de status é o mais fácil. Uma verificação completa tem que subir do fácil ao que importa.

#### 8.2.2 Os três lugares onde a mentira pode estar

Se o documento, o servidor e o teste são três coisas distintas, há três maneiras de uma promessa se romper sem que ninguém veja.

- **O servidor muda e o documento não.** É a cena do começo. A API faz algo diferente do que o documento diz. Quem leu o documento e escreveu o seu cliente a partir dele fica com um programa que funciona contra uma API que já não existe.
- **O documento diz algo que o servidor nunca fez.** É o caso menos comentado e mais comum em documentos escritos à mão: documenta-se o que se pensava fazer, ou o que se fez em outro branch, ou o que se copiou de outra API. O servidor nunca devolve esse `429` ou esse cabeçalho. Quem confia no documento escreve código para um caso que não existe e não escreve o que existe.
- **O teste não olha o que importa.** Um teste em verde diz que o que ele olhou está bem. Não diz nada do que não olhou, e a seção 8.14 (ponto 2) e o exercício 2 provocam esse caso com um exemplo medido: a matriz que já existe, com um servidor ao qual falta um dos cinco membros de todos os erros, dá 40 de 41 e quase não percebe.

Por isso esta lição não se limita a escrever o documento. Ela o escreve, o compara com o servidor, e depois **desfaz** o servidor e o documento de propósito, para ver que a comparação fica vermelha. Uma verificação que nunca foi vista falhando não demonstra nada: o mesmo daria verde se estivesse quebrada.

#### 8.2.3 Por que OpenAPI

Para que um programa compare, o documento tem que estar em um formato com estrutura. O formato mais difundido para descrever APIs HTTP é o **OpenAPI**, uma especificação pública da OpenAPI Initiative. A versão que o curso usa é a **3.1.1**, publicada em 24 de outubro de 2024 ([spec.openapis.org](https://spec.openapis.org/oas/v3.1.1.html)). Existem também o patch **3.1.2** e a linha **3.2** (3.2.0 e 3.2.1), que estão na [página de versões](https://spec.openapis.org/oas/). O curso fica na 3.1.1 porque todas as suas citações de seção e todas as suas saídas foram tomadas contra ela; não se verificou quais ferramentas já entendem a 3.2, e misturar versões em uma lição que cita números de seção seria uma fonte de erros. Quem começar um documento novo deve olhar primeiro qual das três a sua ferramenta entende. Um documento OpenAPI pode ser escrito em JSON ou em YAML, e o curso usa JSON porque o Node o lê sem nenhuma dependência.

A versão 3.1 trouxe uma mudança que se nota no documento do `revisor`: alinha o esquema de dados com o **JSON Schema 2020-12**. A seção 4.8.24 da especificação diz que o objeto de esquema do OpenAPI é um superconjunto dessa versão do JSON Schema. Na prática, quando um campo pode ser nulo, já não se escreve `nullable: true` como na 3.0, e sim uma lista de tipos: `"type": ["object", "null"]`. Isso aparece no esquema `Resultado`, que é `null` enquanto uma revisão está pendente ([a entrada do blog do OpenAPI sobre a passagem da 3.0 para a 3.1](https://www.openapis.org/blog/2021/02/16/migrating-from-openapi-3-0-to-3-1-0) conta essa e outras mudanças).

### 8.3 OpenAPI em cinco peças

Um documento OpenAPI de 1.191 linhas assusta, mas se lê como um livro de cinco capítulos. O que segue os percorre com o `openapi.json` do `revisor` aberto ao lado; as citações e os números de seção são da especificação 3.1.1.

#### 8.3.1 Peça 1: `openapi` e `info`

O documento começa com quatro campos que se leem de relance (`openapi`, `info`, `servers` e `security`):

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

Essa última linha abre a peça 4, que vemos em 8.3.4. O anterior são as peças 1, 2 e 3.

`openapi` diz **que versão da especificação** o documento segue: `3.1.1`. É a primeira coisa que qualquer ferramenta lê, porque disso depende como interpretar o resto.

`info` descreve **o documento**, e aqui há uma armadilha que merece uma linha própria. O campo `info.version` soa como “a versão da API”, e não é: a seção 4.8.2.1 da especificação o define como a versão *do documento OpenAPI* (que é distinta da versão da especificação), e a seção 4.8.1.1 esclarece que não tem relação com o campo `openapi`. O `revisor` tem uma API vigente (a da raiz, `/servicios`), uma versão 1 descontinuada e uma versão 0 retirada; se `info.version` fosse “a versão da API”, qual das três seria? Por isso a `description` do documento diz com todas as letras: `info.version` é a versão *deste documento*. É o tipo de esclarecimento que poupa uma discussão de meia hora com quem o lê pela primeira vez.

`license` diz com que licença o documento é publicado. A que o curso usa é CC BY-SA 4.0, e o campo `identifier` usa o identificador do SPDX, `CC-BY-SA-4.0`.

#### 8.3.2 Peça 2: `servers`

```json
"servers": [{ "url": "http://127.0.0.1:18080" }]
```

É a lista de endereços onde a API vive. Se o campo não está, a especificação diz (seção 4.8.1.1) que o valor padrão é um servidor com a `url` `/`, ou seja, o mesmo lugar de onde o documento é servido. O `revisor` o escreve completo porque, no curso, o documento viaja em um arquivo e não é servido de lugar nenhum.

Repare no que **não** há nessa lista: nenhum endereço interno de uma empresa nem nome de máquina. Um documento OpenAPI quase sempre acaba publicado; tudo o que se escrever em `servers` qualquer um vai ler. Para o curso é `127.0.0.1:18080`, que não é a máquina de ninguém.

#### 8.3.3 Peça 3: `security` e `securitySchemes`

A lista de `security` acima diz que, a menos que uma operação diga outra coisa, todas pedem um esquema chamado `credencial`. Esse nome é definido mais abaixo, em `components`:

```json
    "securitySchemes": {
      "credencial": {
        "type": "http",
        "scheme": "bearer"
      }
    },
```

São três linhas com muito conteúdo: o esquema é do tipo `http`, e o seu esquema (`scheme`) é `bearer`, o que o `revisor` usa com `Authorization: Bearer lectura-a`. Por que não se documenta `Authorization` como um parâmetro de cabeçalho, como se faz com `Idempotency-Key`? Porque a especificação não o leva em conta: na seção 4.8.12.2.1 diz que, se um parâmetro está no cabeçalho e se chama `Accept`, `Content-Type` ou `Authorization`, a definição é ignorada. Os três cabeçalhos têm o seu próprio mecanismo, e o da credencial é este.

Há rotas que não pedem credencial: os redirecionamentos antigos (`/viejo/servicios`, `/api/servicios`) e a versão retirada (`/v0`). A essas se escreve `"security": []` na operação. Uma lista vazia quer dizer “nenhuma”, e está escrito assim na especificação (seção 4.8.10.1): “To remove a top-level security declaration, an empty array can be used.” É a maneira de contar, no documento, o que a Lição 2 contou com uma frase: a rota e o método vêm antes da credencial.

#### 8.3.4 Peça 4: `paths`

Aqui está o corpo do documento. `paths` é um objeto com uma entrada por **rota**; cada rota tem uma entrada por **método** (a especificação admite oito: `get`, `put`, `post`, `delete`, `options`, `head`, `patch` e `trace`, na seção 4.8.9.1), e cada método descreve uma **operação**. O `revisor` tem doze rotas e dezessete operações. Esta é uma completa, a mais curta das que têm erros, a que retira um serviço:

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

Lê-se de cima para baixo:

- `summary`: uma frase para quem lê o documento. Nenhuma máquina a usa para decidir nada.
- `responses`: o mapa do que esta operação pode responder, com o **código como chave**. As chaves vão entre aspas porque em JSON toda chave é um texto, e a especificação (seção 4.8.16.2) diz assim: qualquer código pode ser usado como nome, e só uma propriedade por código. O objeto tem que trazer pelo menos uma resposta (seção 4.8.16: “MUST contain at least one response code”).
- `"204"`: a única resposta de sucesso. Uma resposta *tem* que trazer `description`; é o único campo obrigatório de uma resposta (seção 4.8.17.1), e por isso até o `204`, que não devolve corpo, a leva.
- O resto das respostas são `{ "$ref": "…" }`, o que se explica em 8.4. Por ora basta saber que cada uma aponta para um lugar de `components` onde está escrita uma única vez.

Essa operação não diz nada da sua rota. O parâmetro `{id}` está na entrada da rota, um nível acima, porque é compartilhado pelo `GET`, pelo `PUT` e pelo `DELETE`:

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

O parâmetro `id` está `in: path`, é obrigatório e é um inteiro maior ou igual a 1. A especificação admite quatro lugares para um parâmetro (`query`, `header`, `path` e `cookie`, na seção 4.8.12.2.1); o `revisor` usa `path` para o `id` e `header` para `If-Match`, `If-None-Match` e `Idempotency-Key`.

#### 8.3.5 Peça 5: `components`

É o almoxarifado das peças que se reutilizam. Tem cinco gavetas neste documento: `securitySchemes` (já visto), `parameters` (a chave `Idempotency-Key`), `headers` (nove cabeçalhos com a sua descrição), `responses` (dezoito respostas de erro reutilizáveis) e `schemas` (os corpos). Uma peça é usada de qualquer ponto do documento com uma **referência**: um objeto `{ "$ref": "#/components/responses/E401" }`. O texto depois da cerquilha é o caminho dentro do mesmo documento: `components`, depois `responses`, depois `E401`.

Por que se guarda ali e não se escreve onde se usa? Porque o documento do `revisor` tem dezessete operações e **79 referências às dezoito respostas de erro**. Se cada uma fosse escrita completa, o `401` apareceria 12 vezes com o seu cabeçalho `WWW-Authenticate`, e bastaria alguém corrigir 11 das 12 para o documento se contradizer. Com a referência, o `401` é corrigido uma vez. É o mesmo argumento da Lição 5: o catálogo de `problemas.ts` é uma única tabela e não vinte e quatro frases espalhadas.

> **Uma sutileza das referências.** Na versão 3.1, um objeto de referência também pode trazer um `summary` e uma `description` que **substituem**, por padrão, os da peça referenciada (seção 4.8.23.1). O `revisor` não a usa: todas as suas referências são `$ref` simples, então o que a resposta reutilizável diz é o que qualquer um lê.

### 8.4 Documentar cada erro

#### 8.4.1 Uma resposta reutilizável completa

Esta é a resposta do `401`, tal como vive no documento:

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

Tem três partes, e as três são promessas que a matriz vai conferir.

A **`description`** conta quando ocorre e diz o `type` que leva. É texto para pessoas, e é a única parte onde o documento nomeia o `type` (mais sobre isso em 8.5).

O **`content`** é um mapa cujas chaves são tipos de conteúdo. A chave é `application/problem+json`, não `application/json`, e essa é exatamente a promessa que a “limpeza” da cena do começo rompeu. Embaixo, o `schema` aponta para o esquema `Problema` (visto em 8.4.3).

E os **`headers`** dizem que cabeçalhos acompanham esta resposta. Há aqui uma armadilha clássica, e a especificação a nomeia: se uma resposta define um cabeçalho chamado `Content-Type`, essa definição é **ignorada** (seção 4.8.17). O tipo de conteúdo não é documentado como cabeçalho, é documentado como a chave de `content`. Por isso no `401` aparece só `WWW-Authenticate`, que é o que o código obriga, e o tipo de conteúdo está em outra parte.

#### 8.4.2 Os cabeçalhos que cada código obriga ou promete

O documento do `revisor` declara cabeçalhos em seis das dezoito respostas. A tabela mostra quais e de onde sai cada um:

| Resposta | Cabeçalho | Quem o pede |
|---|---|---|
| `E401` (`401`) | `WWW-Authenticate` | o RFC 9110, seção 15.5.2 (“MUST send a WWW-Authenticate header field”), e o esquema Bearer do RFC 6750; a Lição 2: o desafio da credencial |
| `E405` (`405`) | `Allow` | o RFC 9110, seção 15.5.6: “MUST generate an Allow header field” |
| `E415` (`415`) | `Accept` | a Lição 2: que tipos sim são admitidos |
| `E429` e `E429Salud` (`429`) | `Retry-After` | a Lição 4: quanto esperar |
| `E503` (`503`) | `Retry-After` | o RFC 9110, seção 15.6.4: o servidor “MAY” mandá-lo, e esta API decidiu mandá-lo |

Repare na diferença entre as duas últimas linhas e as anteriores. O `405` **obriga** o seu cabeçalho: sem `Allow`, a resposta descumpre o RFC. O `503` só o **permite**: outra API poderia responder `503` sem `Retry-After` e continuar cumprindo o RFC. Mas **esta** API, a do `revisor`, o manda em cada `503`, e isso é uma promessa própria que o documento escreve, e que quem a integra vai usar para esperar bem. A cena do começo rompeu justamente uma promessa própria, não uma do RFC; por isso a matriz verifica as duas classes com o mesmo rigor.

#### 8.4.3 O esquema `Problema`

O corpo de todos os erros é um Problem Details (Lição 5), e é escrito uma única vez:

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

Esses são os cinco membros que **esta API** promete em cada erro (`required`). Convém dizê-lo com cuidado: o RFC 9457 (seção 3.1) não exige os cinco, e `type` vale `about:blank` se faltar. Pedir todos eles é uma promessa mais estrita que a do RFC, e por isso o documento a escreve e a matriz a verifica. Segue a lista de `properties`, que inclui os cinco mais as duas extensões que o catálogo usa: `errors` (as linhas do `422`, cada uma com o seu `pointer`) e `existente` (a rota do serviço que já existe, no `409` de nome repetido). E fecha com uma linha que parece descuido e é uma decisão: `"additionalProperties": true`. O RFC 9457 permite acrescentar membros de extensão a um Problem Details; um esquema que os proibisse diria algo falso da API assim que um tipo de problema novo acrescentasse um. Deixá-los abertos é honesto: o esquema lista os que hoje se usam sem fechar a porta aos de amanhã.

O tipo de conteúdo `application/problem+json` está registrado na IANA com o RFC 9457 como referência ([registro](https://www.iana.org/assignments/media-types/application/problem+json)); é a chave de `content` em cada resposta de erro.

#### 8.4.4 Onde cabe o que não é um erro: sucessos, corpos vazios e o 405 de PATCH

Os sucessos são documentados com o mesmo cuidado que os erros, porque um cliente também constrói coisas a partir deles. O `201` de `POST /servicios` declara os seus dois cabeçalhos, `Location` e `ETag`, e o esquema `Servicio`. O `304` e o `204` declaram a sua `description` e nenhum `content`, e essa ausência é uma promessa: não trazem corpo, e a matriz a verifica perguntando se o corpo chegou vazio.

Resta um caso que a especificação não deixa escrever como se gostaria: o `405` de `PATCH`. Nenhuma rota do `revisor` admite `PATCH`, e o OpenAPI descreve **operações que existem**; declarar `patch` em uma rota para documentar que não é admitido faria o documento dizer o contrário (que há um `PATCH`). A saída do documento é pôr o `405` nas operações que existem (`GET`, `PUT` e `DELETE` de `/servicios/{id}`) e dizer ali que qualquer outro método recebe essa resposta, com o seu cabeçalho `Allow`. A matriz usa a operação `GET` dessa rota para o cenário do `405` (assim o declara no campo `operacion`, seção 8.6), e o exercício 3 faz testar isso.

#### 8.4.5 O cabeçalho que não é um padrão

`Idempotency-Key` é documentado como um parâmetro reutilizável:

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

A `description` faz o que a Lição 6 disse que esta lição faria: avisa que é um padrão da API e **não um padrão oficial**, e por quê. O rascunho da IETF em que se baseia, `draft-ietf-httpapi-idempotency-key-header-07`, expirou em 18 de abril de 2026 sem ser publicado como RFC. `required: false` é a outra metade da promessa: quem não a manda continua sendo atendido, como antes da Lição 6. Um documento que dissesse simplesmente `Idempotency-Key` sem o aviso estaria prometendo, sem querer, que qualquer outra API a entende da mesma forma.

### 8.5 O catálogo de tipos de problema, cruzado com o documento

A Lição 5 prometeu que o catálogo de tipos podia ser “lido, revisado e documentado de uma só vez”. Há uma forma barata de conferir que o documento cumpre: pegar o catálogo (`CATALOGO` em `problemas.ts`, com 24 tipos desde que a Lição 6 acrescentou dois) e, para cada um, perguntar ao documento duas coisas: alguma operação declara o seu código? O documento nomeia o seu `type`? É o que faz o `fig08_02.ts`. Não precisa de nenhum servidor: lê dois arquivos.

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

Leia por blocos:

- **As linhas de leitura.** `import { CATALOGO }` traz a tabela do servidor; `readFileSync` lê o documento *duas vezes*, como texto (para buscar nomes) e já convertido em objeto (para percorrer os códigos). É a mesma informação vista de dois ângulos, de propósito.
- **`documentados`** é o conjunto de todos os códigos que alguma operação declara. Os três `for` aninhados percorrem rotas, operações e as chaves de cada `responses`.
- **O laço principal** percorre as 24 entradas do catálogo. Para cada uma calcula `nombre`, que é a última parte do `type` (`servicio-inexistente`), exceto com `about:blank`, que não tem nome próprio: é o mesmo para todos esses erros.
- **A lacuna** é contada se falta o código, ou se há nome e o texto do documento não o contém.
- **No final**, o código de saída é `0` só se não há lacunas. Isso permite usá-lo em um script ou em uma etapa de integração contínua.

Rode-o a partir da pasta que contém `fig08_01/`:

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

Em nenhuma das linhas aparece um **NO** exceto em uma: `revision-inexistente`, e não é uma falha do programa: a lacuna existe. Para vê-la com os próprios olhos, peça ao servidor o que o documento promete para essa rota, e compare com o que acontece de verdade na rota vizinha:

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

Compare as duas respostas. `GET /revisiones/99` responde um `404` cujo `type` é `revision-inexistente`. `GET /servicios/99` responde outro `404`, com o `type` `servicio-inexistente`. Mas o documento tem **uma única** resposta de `404` para as duas rotas, `E404`, e a sua `description` diz “type servicio-inexistente ou about:blank”. Para a rota das revisões, essa frase é falsa: quem ler o documento esperará um `type` que essa rota nunca devolve, e não saberá que existe o que sim devolve.

Por que a matriz não viu? Porque o cenário do `404` pede um serviço que não existe (`/servicios/99`) e só confere que o `404` esteja declarado nessa operação. Ninguém perguntou a `/revisiones/{id}` pelo seu `type`. É uma lição geral: **uma verificação que não olha um caso não sabe desse caso**, e o cruzamento desta seção encontrou o que a matriz, por desenho, não olha. Corrigir isso é o exercício 1.

> **Os três pontos cegos deste cruzamento.** Primeiro, busca o nome *em qualquer parte* do texto do documento: se `revision-inexistente` aparecesse na descrição de outra rota, o cruzamento diria “sim” mesmo que `/revisiones/{id}` continuasse errada. Segundo, para os tipos com `about:blank` não confere nada sobre o nome, porque não o têm. Terceiro, não olha se o `status` do catálogo coincide com a rota onde é documentado. É uma rede de segurança barata, não um teste completo; a matriz da seção 8.6 é a que olha as respostas reais.

### 8.6 A matriz de 23 cenários: como é feita

`matriz23.ts` tem umas 680 linhas (`wc -l` dá 676), e uma parte importante são dados, não lógica. Essa é a primeira decisão de desenho e vale a pena vê-la antes do código: os 23 cenários não são 23 funções, são 23 **linhas de uma tabela**, e uma única função as percorre. Acrescentar um cenário é acrescentar uma linha; mudar o que se verifica é mudar uma função, não 23.

#### 8.6.1 Um cenário é um dado

Cada linha tem a forma deste tipo:

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

Campo por campo:

- **`codigo`** e **`nombre`**: o código esperado e uma frase para a linha da saída.
- **`operacion`**: o método e a rota **tal como o `openapi.json` os escreve**. Não são os da requisição: a requisição pode ser `GET /servicios/99` e a operação `["get", "/servicios/{id}"]`, porque no documento a rota leva o parâmetro entre chaves. Com este campo a matriz sabe onde procurar no documento se o código está declarado.
- **`antes`** (opcional): as requisições que é preciso fazer **antes** da que se mede, para deixar o servidor no estado em que o código ocorre. Para um `429` são necessárias três revisões prévias; para um `503`, ligar a manutenção.
- **`peticion`**: a que se mede. Um método, uma rota, cabeçalhos e um corpo.
- **`cabeceras`**: os que a resposta **deve** trazer. É uma lista de nomes, e a comparação não distingue maiúsculas (os cabeçalhos HTTP não as distinguem).
- **`tipo`**: o tipo de conteúdo esperado, ou `null` se não deve haver corpo.
- **`type`**: para os erros, o `type` do Problem Details.
- **`revisarCuerpo`**: uma função opcional para o que é próprio daquele cenário, como “a extensão `existente` aponta para `/servicios/2`”.

Duas linhas, para vê-las funcionando. A do `429`:

```ts
  { codigo: 429, nombre: "demasiadas revisiones", operacion: ["post", "/servicios/{id}/revisiones"],
    antes: [1, 2, 3].map(() => ({ metodo: "POST", ruta: "/servicios/2/revisiones", cabeceras: ESCRIBE })),
    peticion: { metodo: "POST", ruta: "/servicios/2/revisiones", cabeceras: ESCRIBE },
    cabeceras: ["retry-after"], tipo: "application/problem+json", type: PROBLEMA + "demasiadas-revisiones" },
```

Três revisões prévias, e a quarta é a que se mede. Espera o cabeçalho `retry-after`, o tipo de conteúdo `application/problem+json`, e o `type` `demasiadas-revisiones`. E a da manutenção:

```ts
  { codigo: 503, nombre: "mantenimiento", operacion: ["get", "/servicios"],
    antes: [{ metodo: "PUT", ruta: "/mantenimiento", cabeceras: { Authorization: "Bearer admin", ...JSON_ }, cuerpo: '{"activo":true}' }],
    peticion: { metodo: "GET", ruta: "/servicios", cabeceras: LEE }, cabeceras: ["retry-after"], tipo: "application/problem+json", type: PROBLEMA + "en-mantenimiento" },
```

Antes de pedir a lista, liga a manutenção com um `PUT /mantenimiento` feito por `admin`. Repare que a `operacion` deste cenário é `["get", "/servicios"]` e não `/mantenimiento`: o `503` é documentado nas operações que *podem devolvê-lo*, e a matriz procura o código onde um cliente o veria.

#### 8.6.2 A ordem importa, e está escrita

Os cenários compartilham um único servidor, que guarda o seu estado em memória, então a ordem em que rodam faz parte do teste. A lista da matriz respeita quatro dependências, e convém conhecê-las porque são as que quebram primeiro quando alguém reordena:

- O **`201`** cadastra um serviço que recebe o id 7 (os de inicialização são seis). O **`204`** o retira, e depois o **`410`** volta a pedi-lo e descobre que foi retirado. Se o `410` rodasse antes do `204`, daria `200`.
- O **`500`** usa o serviço 4, o que não tem revisões terminadas: é o defeito de propósito da Lição 4, e vive até esta lição justamente para haver um `500` a provocar.
- O **`503`** liga a manutenção no seu `antes`, e o **`504`** a desliga no seu. Se ninguém a desligasse, tudo o que vem depois daria `503`.
- O **`304`** precisa da `ETag` vigente do serviço 1, que muda a cada inicialização. A matriz a lê **uma vez ao começar**, antes do primeiro cenário, e a guarda em `SIN_CAMBIOS`.

#### 8.6.3 A função que verifica

A função `comprobar` recebe um cenário e devolve uma **lista** de falhas; a lista vazia significa que passou. Esta é completa:

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

Siga as linhas na ordem em que são executadas:

1. **As requisições prévias.** São mandadas e o seu corpo é descartado com `.text()`, porque uma resposta que não é lida deixa a conexão ocupada.
2. **A requisição medida.** É mandada com `enviar`, que usa `fetch` com `redirect: "manual"`. Essa opção importa: um `301` ou um `308` tem que ser visto como `301` ou `308`, não como a resposta da rota a que o `fetch` teria ido parar sozinho. Para conferir um redirecionamento, não se deve segui-lo.
3. **O código.** Se não é o esperado, acrescenta-se uma falha.
4. **Os cabeçalhos.** Cada nome da lista tem que estar na resposta.
5. **O tipo de conteúdo e o corpo.** Se o cenário não espera corpo, o texto tem que vir vazio. Se espera, o tipo tem que coincidir; e só se coincide é que se tenta ler o corpo como JSON. Se o cenário é um erro, conferem-se três membros do Problem Details: `type`, `status` igual ao código e `title` do tipo texto.
6. **A verificação própria do cenário**, se tiver.
7. **Os vazamentos**, só nos `5xx`. Explicam-se abaixo.
8. **A documentação.** Se o documento não declara esse código nessa operação, há uma falha. É a linha que une a matriz ao `openapi.json`.

Há uma decisão na estrutura que não se nota até algo falhar: a função **junta todas as falhas** e não para na primeira. Com a “limpeza” da cena, o `503` falha por duas razões (falta `retry-after` e o tipo é `application/json`); um teste que parasse na primeira diria uma, quem a corrigir verá a outra na execução seguinte, e perderá mais uma rodada. É a mesma política do `422` da Lição 3, que junta todas as falhas do corpo.

#### 8.6.4 Os vazamentos

Os erros do servidor são os que mais tendem a contar demais. Um `500` mal tratado pode devolver o stack trace da exceção, e o stack trace leva caminhos de arquivos, nomes de funções e às vezes dados. A Lição 4 ensinou a dizer em um `5xx` só uma referência; a matriz vigia isso com uma lista de padrões que não deveriam aparecer no corpo de um `5xx`:

```ts
const FUGAS = [/\bat \S+ \(/, /file:\/\//, /\/(home|Users)\//, /node:internal/, /\bSELECT\b.+\bFROM\b/i, /Bearer \S+/, /TypeError|ReferenceError/];
```

Leia-os um por um:

| Padrão | O que pega |
|---|---|
| `\bat \S+ \(` | uma linha de stack trace de JavaScript: `at nombre (archivo:línea)` |
| `file://` | o endereço de um arquivo, como os que o Node imprime nos stack traces |
| `\/(home\|Users)\/` | uma pasta de usuário de uma máquina real |
| `node:internal` | um frame interno do Node |
| `\bSELECT\b.+\bFROM\b` | uma consulta SQL |
| `Bearer \S+` | uma credencial |
| `TypeError\|ReferenceError` | o nome de uma exceção de JavaScript |

A lista não é exaustiva, e não pode ser: é um conjunto de sinais do que já se viu, não uma garantia de que não haja outros. Cobre os mais comuns desta classe de servidor. É aplicada **só aos `5xx`** porque é ali que o inesperado se infiltra; um `404` ou um `422` são escritos pelo handler central com frases do catálogo.

#### 8.6.5 Iniciar, medir e desligar

A última coisa que o programa faz é subir o que vai medir e desligá-lo, aconteça o que acontecer:

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

Antes de iniciar qualquer coisa, a matriz confere que as três portas estejam livres: se alguma responde, diz qual e sai com `2`, porque medir contra o programa de outra pessoa é medir o que não é seu (o exercício de “O servidor que ficou aberto” mostra isso). Os dois `spawn` iniciam o laboratório e o `revisor` como processos filhos, com a mesma versão do Node que roda a matriz (`process.execPath`), e `esperarPuerto` (no começo do arquivo, explicada em 8.14.1) espera que cada um aceite conexões em vez de contar um tempo fixo. Se algum não responde em 10 segundos, o `catch` diz isso e a execução termina com `1` sem resumo. O `try … finally` é a parte que torna a matriz honesta: aconteça o que acontecer nas verificações (uma exceção, uma falha, um processo que não iniciou), o `finally` desliga os dois filhos. Sem ele, um erro no meio do caminho deixaria dois processos escutando nas portas 18080 e 18081, e a execução seguinte falharia por uma razão que não tem nada a ver com o que se mede.

A última linha importa para quem usar a matriz em um script: o programa sai com `0` se não houve falhas e com `1` se houve alguma. É isso que permite colocá-lo em uma etapa de integração contínua e fazer a etapa ficar vermelha. Repare também que usa `process.exitCode` e não `process.exit(…)`: atribui o código e deixa o programa terminar sozinho, o que permite que os filhos e as conexões se fechem com calma.

### 8.7 Rodá-la e lê-la

A partir da pasta `fig08_01/`, com as portas 18080, 18081 e 18082 livres (a terceira é usada pelo gateway de uma das verificações adicionais):

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

Leia-a por blocos.

**As primeiras sete linhas** (`200` a `308`) são os sucessos e os redirecionamentos. Cada uma passou o mesmo exame que os erros, mas com outra forma: o `200` e o `201` trazem corpo `application/json` e os cabeçalhos `etag` (e `location` no `201`); o `304`, o `204`, o `301` e o `308` não trazem corpo, e a matriz confere que o texto venha vazio. O `301` e o `308` são `POST`: é o par da Lição 1, com a mesma requisição e dois redirecionamentos que se comportam de modo distinto no cliente.

**As dezesseis seguintes** (`400` a `504`) são os erros. Cada uma conferiu `application/problem+json`, o `type` do catálogo e, em cinco delas, um cabeçalho: `www-authenticate` no `401`, `allow` no `405`, `accept` no `415`, `retry-after` no `429` e no `503`. O `403` tem uma verificação própria que já apareceu na Lição 2: o corpo **não** repete a credencial `lectura-a`. E o `500` confere que `instance` seja um `urn:uuid:…`, a referência que o cliente pode dar a quem opera o servidor.

**As dezoito últimas** não são códigos. São verificações adicionais, e a seção 8.8 as explica.

**A penúltima linha** soma: “41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales)”. E a última linha, `(código de salida: 0)`, é a que um script lê.

Dois detalhes de leitura. A linha do SSRF diz `http://localhost:18080/mantenimiento`: a matriz tenta registrar uma URL com um nome que resolve para a própria máquina, e espera um `422` com o tipo `destino-prohibido`. E o tempo: a execução leva uns 16 segundos, e boa parte são esperas deliberadas: a inicialização, a revisão lenta do `504`, as novas tentativas de `alta-segura.ts` e as reinicializações do `revisor`.

### 8.8 As outras dezoito verificações

Uma vez que os 23 códigos estão verdes, a matriz percorre mais dezoito verificações. Cada uma nasceu de um defeito concreto que as lições anteriores mediram na sua hora, e existe para que esse defeito **não volte sem que alguém perceba**. Chamam-se **regressões**: testes de algo que já foi corrigido uma vez.

| # | O que verifica | De que lição vem |
|---|---|---|
| 1 | `Idempotency-Key`: a mesma chave não duplica; com outro corpo, `422` | 6 |
| 2 e 3 | SSRF: duas URLs (`169.254.169.254` e `localhost`) são rejeitadas com `422 destino-prohibido` | 1 |
| 4 | Uma credencial que só existe em `Object.prototype` (`constructor`, `__proto__`, `toString`) dá `401` | 2 |
| 5 | Requisições condicionais: `If-None-Match` com lista, `W/` e `*` dá `304`; `If-Match` com `W/` dá `412`; com lista ou `*` dá `200` | 1 e 3 |
| 6 | A atualização perdida: dois `PUT` ao mesmo tempo com o mesmo `If-Match`, `200` e `412` | 3 |
| 7 | A ordem do `PUT`: `text/plain` dá `415` com etiqueta velha ou sem ela; se o recurso for retirado no intervalo, `410` | 3 |
| 8 | O esquema `bearer` sem distinguir maiúsculas, e o desafio de `Basic` sem `error="invalid_token"` | 2 |
| 9 | Um método herdado (`constructor`, `toString`, `__proto__`) dá `405` | 1 e 2 |
| 10 | Um corpo JSON que não é um objeto (`null`, `7`, `"texto"`, `[]`) dá `400`, e o `revisor` continua vivo | 1 |
| 11 | O limite de 16 KiB: `413` com `Content-Length` e em partes; exatamente no limite, `400` | 2 |
| 12 | O limite por credencial: a quarta consulta ao vivo, `429`; outra credencial não paga por isso; enumerar ids chega ao `429` | 4 |
| 13 | `Retry-After` estrito: `1.5`, `-1` e “12 30” são ignorados; as três formas de data dão o mesmo | 4 |
| 14 | SSRF com doze endereços de uso especial, rejeitados; um 6to4 com IPv4 público, aceito | 1 |
| 15 | O gateway repassa `Content-Length`; sem `revisor` responde `502` e continua vivo; `alta-segura.ts` termina ao esgotar as tentativas, também sem conexão | 6 |
| 16 | `alta-segura.ts` decide: um `4xx` sai com `1`; obedece `Retry-After` se for razoável e não insiste se pedir muito; é cortado por tempo diante de um servidor mudo; o `409` de chave em andamento é repetido e o de nome repetido não | 6 |
| 17 | A `ETag` depois de reiniciar o `revisor`: a velha já não coincide | 1 |
| 18 | O banco de testes responde o `205` sem corpo (RFC 9110, seção 15.3.6), com `Content-Length: 0` (sem ele, o `205` não tem comprimento declarado e seria lido até a conexão fechar: RFC 9112, seção 6.3) e sem `Transfer-Encoding` (decisão do banco: o Node mandaria `chunked` com um corpo vazio; o RFC não o proíbe no `205`) | 0 |

Três delas têm uma técnica que vale a pena ver, porque mostram como se testa algo que não se pode provocar com uma requisição normal.

#### 8.8.1 A atualização perdida: um corpo que chega aos pedaços

Para testar que dois `PUT` simultâneos com a mesma etiqueta não se atropelam, é preciso conseguir que um **esteja esperando o seu corpo** enquanto o outro escreve. Um `fetch` normal manda cabeçalhos e corpo juntos, então não há intervalo. A solução é um corpo entregue em dois tempos:

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

O corpo da requisição lenta é um `ReadableStream`. Entrega **dez caracteres de imediato** (sem isso, o `fetch` não manda nem os cabeçalhos) e o resto quando a promessa `suelto` é cumprida. A opção `duplex: "half"` é obrigatória quando o corpo é um fluxo: a especificação do `fetch` a exige e `"half"` é o valor usado no Node, e quer dizer que a requisição é enviada completa antes de ler a resposta. Sem ela, o `fetch` rejeita com `TypeError: RequestInit: duplex option is required when sending a body.` (medido com o Node 24.14.1). Enquanto isso, a requisição rápida altera o serviço com a mesma etiqueta. Quando a rápida termina, chama-se `soltar()`, e a lenta termina de mandar o seu corpo. O servidor, que comparou a etiqueta ao começar, a compara outra vez ao escrever (Lição 3), a encontra vencida e responde `412`. As três verificações finais encerram o caso: a rápida dá `200`, a lenta dá `412`, e o serviço fica com o valor da rápida.

Este teste **quase não depende da sorte**. Poderia-se tentar com dois `fetch` simultâneos e esperar que coincidissem, e seria um caso que às vezes falha e às vezes não. Aqui a única espera por relógio são os 300 ms que se dão ao primeiro pedaço para chegar; a partir daí a ordem é forçada pelo programa (`soltar()`), não pelo acaso.

#### 8.8.2 O método herdado: bater à porta sem servidor

O `Object.prototype` tem métodos com nomes como `constructor` ou `toString`. Se o ponto de entrada do `revisor` procurasse o método de uma requisição em um objeto comum, `constructor` apareceria como se fosse um método da rota. A correção é procurá-lo com `Object.hasOwn`. Como conferir isso, se o Node responde `400` a um método que não conhece antes de chamar o `revisor` (dá para ver com `curl -X constructor`)? Chamando o ponto de entrada **diretamente**, sem servidor:

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

A função importa `atender` de `rutas.ts` e a chama com uma requisição e uma resposta **de mentira**: dois objetos com apenas o que o ponto de entrada lê. Se ele responde com um `405` (o `statusCode` que `writeHead` recebeu), tudo bem; se lança uma exceção, a promessa de `listo` é resolvida com o texto “excepción …”. Antes de chamar, silencia `console.log`, porque o ponto de entrada escreve cada requisição no terminal e aqui rodaria dentro da matriz; e o restaura ao terminar. É um teste de **unidade** metido em uma matriz de integração, e está certo: o importante é que seja executado, não o nome do tipo de teste.

#### 8.8.3 A ETag depois de reiniciar: matar e subir

A última técnica é reiniciar o servidor a partir da própria matriz:

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

Lê a etiqueta do serviço 3, que nunca muda, mata o `revisor` que ela mesma subiu, volta a iniciá-lo, e pede o serviço 3 com a etiqueta de antes. Se o `revisor` repetisse a etiqueta (`"3-1"` antes e `"3-1"` depois), responderia `304`, um `304` falso: o cliente ficaria com uma cópia de antes da reinicialização. Com o identificador de inicialização na etiqueta (`"3-1-86b39f38"` contra outra de oito dígitos), responde `200`. É a regra do RFC 9110, seção 8.8.1, que pede que uma etiqueta forte não seja reutilizada para outra representação.

### 8.9 O mesmo, com `curl`

A matriz em TypeScript é a que se roda a cada mudança, mas a primeira pergunta de quem a lê costuma ser: *e isso, escrito à mão, como seria?* O `fig08_03.sh` responde essa pergunta. É a mesma ideia dos 23 cenários escrita como seria digitada em um terminal: requisições com `curl`, um tipo de conteúdo e um cabeçalho esperados, um contador no final. Sobe o laboratório e o `revisor` por conta própria e os desliga por PID ao terminar.

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

Cinco ideias do script:

- **A porta de entrada.** Antes de subir qualquer coisa, tenta abrir uma conexão com cada porta usando `/dev/tcp`, um recurso do `bash`. Se alguém responde, a porta está ocupada e o script se recusa a seguir: medir contra o programa de outra pessoa é um jeito seguro de ver resultados que não são seus.
- **`probar`.** É a função que faz todo o trabalho. Recebe o código esperado, um nome, o tipo de corpo (`problema`, `json` ou `nada`), o cabeçalho obrigatório (ou um hífen se não houver) e os argumentos do `curl`. Pede ao `curl` que guarde os cabeçalhos em um arquivo (`-D`), que não imprima o corpo (`-o /dev/null`) e que escreva o código e o tamanho do corpo (`-w '%{http_code} %{size_download}'`). Depois compara.
- **`size_download`.** Para saber que um `204` ou um `304` não traz corpo, não é preciso ver o corpo: o tamanho do que foi baixado tem que ser zero.
- **`trap … EXIT`.** É o `finally` do script: desliga o laboratório e o `revisor` por PID e apaga o arquivo temporário de cabeçalhos, mesmo que o script termine por um erro.
- **O `sleep 1`.** É a mesma espera fixa que a seção 8.14.1 substitui na matriz em TypeScript; aqui se conserva por simplicidade, e é o primeiro lugar onde este script falharia em uma máquina lenta.

Rode-o a partir da pasta que contém `fig08_01/`:

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

Vinte e três de vinte e três, e o script sai com `0`. A versão em `curl` é honesta sobre o que verifica menos: olha o código, o tipo de conteúdo, o cabeçalho e, para os sucessos sem corpo, o tamanho. **Não** olha o `type` do corpo, nem o `status` do corpo, nem os vazamentos, nem se o código está declarado no documento. Tampouco roda as dezoito adicionais. Serve para ver o esqueleto da ideia e para conferir uma mudança rápida sem o Node à mão; a verificação completa é a de TypeScript.

### 8.10 Que o teste morda

Uma verificação que nunca foi vista falhando não demonstra nada: dará verde igualmente se funciona ou se está quebrada. Por isso várias verificações da matriz foram testadas duas vezes, uma com a correção posta e outra com a correção desfeita, e anotou-se que número a matriz dava em cada caso (as desta seção, a do `405` do exercício 3, a do corpo em partes de 8.14.1 e a da inicialização lenta do exercício 6). As demais não têm um controle negativo guardado, e é uma das coisas que a matriz não promete (seção 8.14). Aqui isso fica por conta de quem acompanha, com dois defeitos de propósito, um no servidor e outro no documento. Os dois estão na pasta `defectos/`, com um aviso na primeira linha do arquivo.

#### 8.10.1 O servidor “limpo”

O primeiro defeito é a cena do começo. Muda um único arquivo, `problemas.ts`, o handler central de erros. O que muda é isto:

```ts
    // DEFECTO A PROPÓSITO: se quitó Retry-After (una «limpieza» de cabeceras) ...
    ...Object.fromEntries(Object.entries(opciones.cabeceras ?? {}).filter(([nombre]) => nombre.toLowerCase() !== "retry-after")),
    // ... y el tipo de contenido pasó a ser el genérico.
    "Content-Type": "application/json",
```

São duas mudanças, cada uma razoável vista isoladamente. A primeira tira um cabeçalho que a alguém pareceu sobrando. A segunda unifica o tipo de conteúdo de todos os erros com o dos sucessos. Nenhum código de status muda. Para provocá-lo, copie a pasta, substitua o arquivo e rode a matriz:

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

Leia-a como o faria quem a vê pela primeira vez às 10h05. A primeira coisa que chama a atenção é o que **não** falha: as sete primeiras linhas (os sucessos e os redirecionamentos) continuam em verde, e também todas as verificações adicionais exceto uma. A segunda é o que falha: **todos** os erros, do `400` ao `504`, com a mesma mensagem: o tipo de conteúdo que chegou é `application/json` e se esperava `application/problem+json`. No `429` e no `503` a mensagem traz uma frase a mais, `falta retry-after`, e na verificação adicional dos `429` por credencial ela se repete. E o `401`, o `405` e o `415` conservam os seus cabeçalhos (`www-authenticate`, `allow`, `accept`), porque o defeito só tirou o `Retry-After`. Cada falha diz **que promessa se rompeu e em que cenário**, e a lista completa tem 17 linhas vermelhas de 41; o programa sai com `1`.

Há um dado que importa mais que a contagem: **nenhuma linha diz “código”**. Se os testes da cena do começo tivessem sido só de código, esta execução teria dado 41 de 41. A matriz não vê só o código, e por isso teria ficado vermelha na própria segunda-feira em que a mudança foi publicada.

#### 8.10.2 O documento que ficou para trás

O segundo defeito vive no documento. É a outra metade da cena: alguém acrescentou o `429` ao servidor e não o escreveu, ou o escreveu e depois o tirou. Para provocá-lo, o arquivo `defectos/sin-429-documentado/openapi.json` é o documento de sempre sem o `429` de `POST /servicios/{id}/revisiones`:

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

No final dessa saída está o mesmo documento passado por um validador (o Redocly, que se instala em 8.11; os três comandos copiam cada documento para a pasta do validador com o nome `openapi.json`); é explicado em 8.11.3. A matriz marca **uma** falha, exatamente a que corresponde: `429 demasiadas revisiones: openapi.json no documenta 429 en POST /servicios/{id}/revisiones`. O servidor continua fazendo o que fazia; o documento deixou de dizê-lo, e a matriz percebeu porque o cenário do `429` pergunta, no final de `comprobar`, se o documento declara esse código nessa operação (seção 8.6.3). É um resultado limpo: 40 de 41, uma única linha vermelha, um único culpado.

> **Uma linha de aviso dentro de um JSON.** O JSON não admite comentários, então um aviso na primeira linha não pode ser escrito como em TypeScript. O arquivo usa a maneira que a especificação do OpenAPI oferece para isso (seção 4.9, “Specification Extensions”): um campo cujo nome começa com `x-` pode levar qualquer valor, e o documento continua válido. Por isso a primeira linha do defeito é `{ "x-defecto": "DEFECTO A PROPÓSITO …",`.

### 8.11 Um documento válido não é um documento verdadeiro

O mesmo documento do qual se tirou o `429` faz uma coisa interessante quando é dado a um validador de OpenAPI. Um **validador** (em inglês, *linter* quando também opina sobre o estilo) lê o documento e diz se está bem escrito segundo a especificação. Há vários; o curso usa o **Redocly CLI**, uma ferramenta de linha de comando com licença MIT, e o seu comando `lint` ([documentação](https://redocly.com/docs/cli/commands/lint)). Não é uma dependência do `revisor`: instala-se à parte, em uma pasta de trabalho, e descarta-se quando terminar.

```text
$ mkdir ~/validador && cd ~/validador
$ npm init -y
$ npm install --no-save @redocly/cli@2.57.0
$ cp ~/curso-http/fig08_01/openapi.json .
```

#### 8.11.1 O documento do `revisor`, validado

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

Leia de cima para baixo. A linha do início avisa que nenhuma configuração foi dada e que se usa a **recomendada**, que é o valor padrão do comando. Seguem 26 avisos (*warnings*), e o veredito: “Woohoo! Your API description is valid.” Ou seja: zero erros. O documento está bem escrito segundo a especificação.

Os 26 avisos não são erros, e se dividem em três grupos que convém entender:

- **17 de `operation-operationId`.** Cada operação pode levar um `operationId`, um identificador único (a especificação, seção 4.8.10.1, diz que deve ser único entre todas as operações do documento). Serve às ferramentas que **geram código** a partir do documento, para nomear as funções. O curso não gera código, então o documento não o traz. É uma decisão, e o aviso é o validador perguntando se foi esquecido.
- **5 de `operation-2xx-response`.** Cinco operações não declaram nenhuma resposta `2xx`: os dois redirecionamentos antigos (`GET` e `POST` de `/viejo/servicios` e de `/api/servicios`, quatro) e `GET /v0/servicios` (a versão retirada, que só responde `410`). É verdade: essas rotas não têm sucesso. O aviso é o validador perguntando se é de propósito, e é.
- **4 de `operation-4xx-response`.** Os quatro redirecionamentos também não declaram nenhuma resposta `4xx`.

Nenhum dos 26 é uma promessa rompida, e por isso o documento fica como está. Mas é o tipo de decisão que se toma à vista, não em silêncio: roda-se o validador, lê-se cada grupo e decide-se.

#### 8.11.2 O controle positivo: um documento que está mesmo mal escrito

Um validador que sempre diz “válido” também não prova nada. Para ver que o de cima **morde**, o defeito `documento-roto` tem dois erros de escrita: uma referência a uma resposta que não existe (`E4O1`, com a letra O em vez do zero) e um `204` sem a sua `description`:

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

Agora sim: **dois erros**, e o validador se recusa a dá-lo por bom. O primeiro diz `no-unresolved-refs`, “Can't resolve $ref”, na linha 38, que é a referência mal escrita. O segundo diz `struct`, “The field `description` must be present on this level”, na linha 263, que é o `204`: a especificação (seção 4.8.17.1) exige `description` em toda resposta. Os dois são do tipo de erro que se infiltra em um documento de mais de mil linhas escrito à mão, e o validador os pega sem que nenhum servidor rode.

#### 8.11.3 A conclusão incômoda

Agora a mesma ferramenta, contra o documento da seção 8.10.2, o que não tem o `429`:

```text
$ npx redocly lint openapi.json --format=stylish
```

O veredito: “Woohoo! Your API description is valid.”, com 27 avisos, um a mais que os 26 de antes. O novo diz `no-unused-components`: “Component: "E429" is never used.” Ou seja, o validador **sim notou** algo: a resposta reutilizável `E429` ficou sem nenhuma operação que a use. Mas disse isso como aviso, não como erro, e não tinha como saber que o servidor continua devolvendo esse `429`. O documento continua sendo válido, e o validador **não** viu que ele mentia.

Isso não é uma falha do validador. Um validador responde à pergunta *está bem escrito?*, e o documento sem o `429` está perfeitamente bem escrito: apenas não menciona um código que o servidor sim devolve. Para responder *é verdade?* é preciso comparar o documento com o servidor, e é isso que a matriz faz. As duas ferramentas não se substituem, se complementam:

| Pergunta | Quem responde | Exemplo nesta lição |
|---|---|---|
| Está bem escrito? | o validador (`redocly lint`) | a referência `E4O1` e o `204` sem `description` |
| É verdade? | a matriz (`matriz23.ts`) | o `429` que o servidor devolve e o documento cala |
| Diz tudo? | o cruzamento do catálogo (`fig08_02.ts`) | `revision-inexistente`, que o documento não menciona |

Uma API com só a primeira linha tem um documento elegante e desatualizado. Uma API com só a segunda tem uma verificação que depende de um documento que ninguém sabe se pode ser lido. Com as três, cada tipo de erro tem quem o pegue.

### 8.12 DNS rebinding: a lacuna da Lição 1, fechada

A Lição 1 deixou uma dívida anotada em um comentário de `destinos.ts`: o `revisor` valida o destino antes de cada conexão, e mesmo assim resta uma janela. Hoje ela se fecha. Antes de ver como, convém contar por que importa com dois casos deste mesmo ano.

#### 8.12.1 Dois avisos públicos

Em 10 de julho de 2026 foi publicado um aviso de segurança sobre o `mcp-atlassian`, um servidor MCP de código aberto e de terceiros (não é um produto da Atlassian) para conectar agentes de IA ao Jira e ao Confluence ([GHSA-489g-7rxv-6c8q](https://github.com/advisories/GHSA-489g-7rxv-6c8q)). O interessante é que **já havia tido uma correção** contra SSRF; o aviso trata de por que essa correção não bastou. A correção resolvia o nome uma vez, para revisá-lo, e a requisição posterior voltava a usar o nome tal como estava, de modo que, diz o aviso, a requisição “re-resolve ao conectar, sem fixar o IP” (tradução nossa de: *re-resolves at connect time with no IP pinning*). Um nome controlado por quem ataca pode responder um endereço público enquanto é revisado e um interno (como `169.254.169.254`, onde as nuvens publicam os metadados da máquina) quando se conecta. O aviso esclarece que o teste que acompanha o relatório não demonstra um ataque completo contra um servidor em funcionamento, e que explorá-lo exige ganhar essa corrida. Ele o qualifica como uma corrida entre a verificação e o uso (em inglês, *TOCTOU*, *time of check, time of use*) e a versão que o corrige é a 0.22.0.

Quase um mês antes, em 15 de junho de 2026, havia sido publicado outro, com o mesmo padrão e em outro produto: o **CVE-2026-53708**, em um gateway de servidores MCP ([aviso GHSA-9hgc-g3w5-67cm](https://github.com/advisories/GHSA-9hgc-g3w5-67cm)). Um ponto de acesso de administração revisava o nome de uma URL resolvendo-o, bloqueava o que era privado, e depois **entregava o nome original** ao cliente HTTP, que o resolvia outra vez. Um atacante que controla o DNS pode devolver um IP público durante a validação e um privado durante a conexão. Foi corrigido na versão 1.0.3 (gravidade moderada, CVSS 6.6). O aviso diz assim: o ponto de acesso valida o nome resolvendo-o, e o cliente HTTP, por conta própria, volta a resolver o nome ao conectar sem que nada una as duas operações (paráfrase nossa do aviso, que está em inglês). A recomendação é a mesma do outro aviso: fixar o IP já validado na conexão.

Um esclarecimento de nomes: “DNS rebinding” designa, no sentido clássico, um ataque a partir do navegador contra a política de mesma origem; os avisos (e o OWASP) chamam do mesmo jeito esta corrida do lado do servidor, que é o sentido que tem aqui. Os dois têm algo em comum com o `revisor` da Lição 1: um programa cujo trabalho é conectar-se a endereços que outra pessoa lhe deu. E os dois tiveram o defeito que a Lição 1 nomeou e deixou aberto: validar e conectar são **duas resoluções**, não uma. O guia do OWASP sobre SSRF diz sem rodeios: “um segundo DNS lookup sem revisão entre a validação e a conexão pode contornar essas defesas” (tradução nossa); e recomenda conectar-se somente aos endereços validados, conservando o nome original para o cabeçalho `Host`, o SNI e a verificação do certificado ([guia do OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)).

#### 8.12.2 O mecanismo, com as próprias mãos

Antes de ler a defesa, faça o ataque acontecer, em pequeno e sem atacar ninguém. O `fig08_04.ts` simula um DNS que mente: a **primeira** vez que lhe perguntam por `rebote.ejemplo`, responde `127.0.0.1` (o laboratório, que é permitido); a partir da **segunda**, responde `::1`, onde escuta outro servidor que responde `299` (um código que mais ninguém devolve, para reconhecê-lo). `dns.lookup` e `dns/promises.lookup` são substituídos por funções nossas que contam quantas vezes são chamadas. Nada disto sai da máquina:

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

As partes que importam:

- **Dois servidores, dois endereços.** O “laboratório” escuta em `127.0.0.1:18081`, e “o outro” em `[::1]:18081`. É o mesmo número de porta em dois endereços distintos, o que é possível porque um endereço IPv4 e um IPv6 são lugares distintos.
- **`responder`.** É o DNS que mente: conta quantas vezes é chamado e responde um endereço diferente conforme o número da pergunta.
- **Dois patches.** `dnsPromesas.lookup` é usado por `destinos.ts` para validar (a versão de promises), e `dns.lookup` é usado pelo Node por dentro quando uma conexão pede a um nome o seu endereço (a versão de *callback*). Esse segundo patch tem duas formas de responder, porque `dns.lookup` pode ser pedido com a opção `all` ou sem ela (o manual do Node, na página de `dns`: com `all` os argumentos do *callback* são `(err, addresses)`; sem ela, `(err, address, family)`).
- **`syncBuiltinESMExports()`.** Quando se importa `{ lookup }` de um módulo interno do Node, o nome `lookup` fica fixo no valor que tinha naquele momento. Depois de substituir a função é preciso sincronizar os nomes exportados, senão `destinos.ts` continuaria chamando a original.
- **O `import()` dinâmico no final** carrega `cliente.ts` da pasta passada como argumento. Primeiro se aplica o patch, depois se importa; ao contrário não funcionaria.

O programa recebe a pasta do cliente que se quer testar. Para o primeiro experimento é preciso o cliente da Lição 7, o que usa `fetch`. Está em `defectos/con-fetch/` (dois arquivos: `cliente.ts` e `destinos.ts`, com aviso na primeira linha). Monte uma pasta com os arquivos do `revisor` e substitua esses dois:

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

O primeiro bloco é o ataque: o cliente da Lição 7 perguntou **duas vezes** ao DNS. A primeira (para validar) obteve `127.0.0.1`, que está na lista de permitidos; a segunda (a que o `fetch` fez por dentro ao conectar) obteve `::1`, e o cliente chegou ao servidor de `299` sem que nenhuma regra de `destinos.ts` o visse. O segundo bloco é a defesa: o cliente desta lição perguntou **uma única vez**, conectou-se ao que lhe responderam e chegou ao laboratório, com um `200`. A mesma consulta, o mesmo nome, o mesmo DNS que mente: dois clientes, dois destinos.

> **É uma simulação, e diz isso.** O DNS que mente é uma função nossa; o “outro servidor” é um servidor nosso. Um atacante real, além disso, precisa de uma resposta com validade (TTL) muito baixa e que nenhum cache (do sistema operacional ou do resolvedor) repita a primeira resposta, coisa que a simulação pula por construção; e o patch de `dns.lookup` funciona porque `net.connect` consulta essa função ao conectar, o que é uma suposição sobre como o Node é feito e não uma garantia. Se o sistema não tiver `::1`, troque o segundo servidor por `127.0.0.2` (o Linux o admite como loopback). O teste demonstra que o cliente da Lição 7 **volta a perguntar** e que o da Lição 8 **não**, que é o que é preciso saber. Não demonstra que um atacante real possa explorar o `revisor`: isso depende de onde ele roda, de que rede tem ao redor e da segunda camada que a Lição 1 pediu (uma rede que não deixe chegar aos metadados mesmo que o programa tente).

#### 8.12.3 A defesa: conectar-se ao endereço já validado

A defesa são três mudanças pequenas. A primeira está em `destinos.ts`: `revisarDestino` já não responde só “sim” ou “não”, responde “sim, e estes são os endereços que revisei”:

```ts
// Si se permite, trae las direcciones ya validadas: quien se conecte debe usar una de éstas.
export type Veredicto = { permitido: true; direcciones: string[] } | { permitido: false; motivo: string };
```

E no final da função, em vez de `return { permitido: true };`, devolve `return { permitido: true, direcciones };`. Quem se conectar tem agora à mão exatamente os endereços que passaram na revisão, e nenhum outro.

A segunda e a terceira estão em `cliente.ts`. Primeiro, uma função que **não resolve nada**:

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

`soloA` recebe um endereço e devolve uma função de busca (*lookup*) que **sempre responde esse endereço**, sem perguntar a ninguém. O tipo `LookupFunction` vem de `node:net`. A opção `lookup` de `http.request` e de `net.connect` existe para isto: segundo o manual do Node, o valor padrão dela é `dns.lookup()`, e pode ser substituído por qualquer função com a mesma forma. Os dois caminhos do `if` não são enfeite. Desde o Node 20, `net.connect` tem ativada por padrão a opção `autoSelectFamily`, que tenta endereços IPv4 e IPv6 em sequência e, quando está ativa, passa a `lookup` a opção `all: true`; nesse caso a função espera uma **lista** de endereços, não um só. Por isso `soloA` responde das duas maneiras, conforme o que lhe pedirem.

Depois, a função que faz a requisição:

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

Três decisões, em ordem:

- **Passa-se o objeto `URL`, não um endereço.** `pedirCon(url, opciones, …)` toma o nome da URL para o cabeçalho `Host` e, em `https`, para o **SNI** e a verificação do certificado, e toma de `lookup` **aonde se conectar**. Por isso o servidor do laboratório recebe `Host: rebote.ejemplo:18081` mesmo que a conexão tenha ido a `127.0.0.1` (isso será conferido no exercício 4).
- **`agent: false`.** O manual do Node diz que com esta opção se usa um agente novo de uso único, e que serve “to avoid connection reuse”. Uma conexão reutilizada de um agente compartilhado poderia ter sido aberta antes, para outro endereço; com `agent: false`, cada consulta abre a sua, para o endereço que acaba de validar.
- **`signal`.** É o `AbortSignal` com o limite de tempo. Aborta a requisição inteira, não só a conexão: é o que antes fazia `AbortSignal.timeout` com `fetch`.

E o corpo de `consultar`, que fecha o círculo:

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

A sequência importa: **primeiro** se revisa o destino (`revisarDestino`, que resolve uma vez), **depois** se monta o limite de tempo, e **por último** se conecta a `veredicto.direcciones[0]`. Não há uma terceira resolução. `respuesta.destroy()` corta a leitura depois dos cabeçalhos: ao `revisor` só interessam o código e os cabeçalhos, não o corpo. E a classificação de erros mudou de forma, não de fundo: antes olhava uma exceção do `fetch` (`DOMException` com `TimeoutError`, ou a `cause` com o `code`); agora olha se o sinal foi abortado (`tiempo.aborted`) ou o `code` da exceção do Node. Os cinco desfechos são os mesmos.

#### 8.12.4 O que não mudou: o certificado, o redirecionamento e os desfechos

Três perguntas razoáveis, com resposta medida.

**O certificado continua sendo verificado contra o nome?** Sim, e essa é a razão para passar a `URL` e não o IP. Foi conferido contra um site público e dois de teste da comunidade dos navegadores, um com o certificado vencido e outro com um nome que não coincide (precisa de internet):

```text
$ node --input-type=module -e 'import { consultar } from "./cliente.ts"; console.log(JSON.stringify(await consultar(process.argv[1], 8000)))' https://example.com/
{"tipo":"respuesta","codigo":200,"ms":484,"reintentarEn":null}
$ node --input-type=module -e 'import { consultar } from "./cliente.ts"; console.log(JSON.stringify(await consultar(process.argv[1], 8000)))' https://expired.badssl.com/
{"tipo":"respuesta-invalida","motivo":"certificate has expired"}
$ node --input-type=module -e 'import { consultar } from "./cliente.ts"; console.log(JSON.stringify(await consultar(process.argv[1], 8000)))' https://wrong.host.badssl.com/
{"tipo":"respuesta-invalida","motivo":"Hostname/IP does not match certificate's altnames: Host: wrong.host.badssl.com. is not in the cert's altnames: DNS:*.badssl.com, DNS:badssl.com"}
```

O primeiro responde `200`. Os outros dois são `respuesta-invalida`, com o motivo dado pelo Node: `certificate has expired` em um, e no outro que o nome do servidor não está entre os do certificado. O que isto prova é que o nome **continua** sendo comparado com o certificado: o cliente só mudou aonde o socket se conecta, não contra o quê se verifica.

Para ver o que aconteceria se em vez disso o nome fosse substituído pelo IP na URL, o `fig08_07.ts` faz exatamente isso (resolve o nome, monta `https://<IP>/` e pede a página):

```text
$ node fig08_07.ts example.com
{"nombre":"example.com","error":"EPROTO"}
$ node fig08_07.ts expired.badssl.com
{"nombre":"expired.badssl.com","error":"CERT_HAS_EXPIRED"}
$ node fig08_07.ts wrong.host.badssl.com
{"nombre":"wrong.host.badssl.com","error":"CERT_HAS_EXPIRED"}
```

Essa não é uma alternativa: **nem sequer o site bom** funciona (`example.com` termina em `EPROTO`, um erro do handshake TLS: sem o nome, o servidor não sabe que certificado mostrar), e os dois sites ruins tampouco dão `200` (ambos acabam em `CERT_HAS_EXPIRED`: a validade de um certificado é sempre conferida, e sem o nome o servidor oferece o que tiver por padrão). Ou seja, conectar “ao IP” não relaxa a verificação, a quebra por outro lado e com outra mensagem. Por isso `consultar` passa a `URL` com o nome e muda só o endereço do socket: conserva-se o nome para o cabeçalho `Host`, para o SNI e para a verificação do certificado.

**Os redirecionamentos continuam sendo seguidos?** Não. Uma consulta a um destino que responde `301` devolve `301`, não a resposta do lugar para onde ele aponta. `http.request` não segue redirecionamentos sozinho, e o `revisor` tampouco os segue: o guia do OWASP os lista como uma via para contornar a validação (uma URL permitida que redireciona para uma proibida), e a recomendação é desativá-los. Antes isso se obtinha com `redirect: "manual"` no `fetch`; agora, simplesmente não os seguindo.

**Algum desfecho mudou?** Não. Os cinco tipos de `Consulta` são os mesmos, e os códigos que saem na matriz são os mesmos. A única coisa que muda é o texto interno do `motivo` em `respuesta-invalida`, que nenhuma resposta do servidor mostra.

#### 8.12.5 O que esta defesa não faz

Seria um mau costume fechar uma seção de segurança dizendo “pronto”. Três limites, à vista.

- **Conecta-se a um único endereço.** `veredicto.direcciones[0]` é o primeiro dos que o DNS revisou. Se o nome tem vários e o primeiro não responde, o `revisor` não tenta o segundo: pelo que se lê no código, um nome cujo primeiro endereço recusa a conexão conta como `sin-conexion`, embora o segundo funcione. É o preço de fixar o endereço; uma versão que tentasse os seguintes teria que aplicar a mesma revisão a cada um. O guia do OWASP pede assim: aplicar a política de destino também às novas tentativas e às conexões alternativas.
- **Não substitui a rede.** Um `revisor` exposto à internet deveria rodar em uma rede que não tenha rota para o que não deve alcançar. A Lição 1 disse isso; continua sendo verdade. Esta defesa reduz o que depende de um arquivo.
- **Não cobre o que não passa por `consultar`.** Hoje o único lugar onde o `revisor` se conecta é `cliente.ts`. Se amanhã alguém acrescentar outro (um aviso por e-mail, o download de um arquivo), ele tem que passar pelo mesmo ponto de entrada, e a matriz da seção 8.6 **não sabe disso**: só confere os destinos que lhe são dados.

### 8.13 Versões da API no documento

A Lição 3 mostrou como se retira uma versão sem surpreender ninguém: meses de avisos e, no final, um `410`. Faltava um lugar onde esses avisos estivessem escritos para as máquinas, e é o documento. Primeiro, o que o servidor faz de verdade:

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

Vejamos o que importa das três respostas. `/v1/servicios/1` responde `200` com três cabeçalhos: `Deprecation`, `Sunset` e `Link`. `/v0/servicios` responde `410`, com o tipo `version-retirada`. E a rota `PATCH` do último bloco já é conhecida da seção 8.4.4.

#### 8.13.1 O que dizem os três cabeçalhos

`Deprecation` é o RFC 9745, publicado em março de 2025 na trilha de padrões (*Standards Track*). O valor dele é uma **data** no formato dos campos estruturados do HTTP, um número de segundos desde 1970 precedido por uma arroba: a seção 2.1 diz “Deprecation is an Item Structured Header Field; its value MUST be a Date”. O valor que o `revisor` manda, `@1782864000`, é 1º de julho de 2026 às 00h em UTC. Quer dizer “esta versão foi descontinuada nessa data”, e a data pode estar no passado ou no futuro.

`Sunset` é o RFC 8594, de maio de 2019, **informativo**. O valor dele é uma data HTTP comum (`Sun, 31 Jan 2027 00:00:00 GMT`), e diz quando se espera que o recurso deixe de responder. O próprio RFC diz que quem o recebe deve tomar as datas como dicas (*hints*), não como garantias. A relação entre as duas vem na seção 4 do RFC 9745: a data de `Sunset` não deve ser anterior à de `Deprecation`, e a da versão 1 do `revisor` (31 de janeiro de 2027) é sete meses posterior.

`Link` com `rel="deprecation"` aponta para a documentação humana da descontinuação: o guia para migrar. O RFC 9745 registra essa relação e dá um exemplo com o mesmo formato que o `revisor` usa.

#### 8.13.2 Como isso se diz em OpenAPI

O documento tem três lugares onde as versões aparecem:

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

É a operação `GET /v1/servicios`, e traz três coisas:

- **`"deprecated": true`.** É um campo da operação. A especificação (seção 4.8.10.1) diz: “Declares this operation to be deprecated. Consumers SHOULD refrain from usage of the declared operation.” É o aviso para máquinas: as ferramentas de documentação costumam riscar a operação, e as que geram código podem marcar a função como obsoleta.
- **Os três cabeçalhos** (`Deprecation`, `Sunset` e `Link`) na resposta `200`, referenciados a partir de `components/headers`, cada um com a sua descrição e o RFC que o define.
- **A retirada**, `/v0/servicios`, com `deprecated: true`, `"security": []` (não pede credencial, porque o `410` é respondido antes de perguntar quem é) e apenas a resposta `410`, a mesma `E410` que o serviço retirado usa, porque o catálogo reutiliza o esquema `Problema` com o `type` próprio `version-retirada`.

E há uma terceira linha que fecha o círculo: na `info` do documento, a descrição diz que `info.version` é a versão **do documento**, e que a API vigente vive na raiz, com a v1 descontinuada e a v0 retirada. Sem essa frase, quem lesse `"version": "1.0.0"` pensaria que `/v1` é a vigente.

Um detalhe de desenho que vale dizer em voz alta: **as versões vivem na rota** (`/v1/…`, `/v0/…`), e a vigente não leva prefixo. Há outras maneiras de versionar uma API (por cabeçalho, por tipo de conteúdo) e o OpenAPI descreve todas; a rota é a mais fácil de documentar, porque cada versão é uma entrada de `paths` e cada uma pode ser marcada como `deprecated` separadamente.

### 8.14 O que a matriz não promete

Uma verificação honesta diz o que não vê. Sete coisas, com a sua evidência.

**1. Não olha os casos que não escreveu.** É o que o cruzamento da seção 8.5 ensinou: `GET /revisiones/{id}` devolve um `type` que o documento não menciona, e a matriz estava em verde porque o seu cenário do `404` pede um serviço, não uma revisão. Cada rota que não tem o seu cenário é uma rota que a matriz não conhece.

**2. Olha se os membros estão, não se a forma deles é a correta.** Confere `type`, `status` e `title` em todos os erros; não confere `detail` nem `instance`, exceto no `500`. O exercício 2 mede isso: com um servidor ao qual falta `instance` em todos os seus erros, a matriz atual dá **40 de 41**, e a única falha é a do `500`; a ampliação de duas linhas a leva a **25 de 41**.

**3. Não compara os corpos com os seus esquemas.** O esquema `Servicio` diz que um serviço tem `id`, `nombre`, `url` e `limite_ms`; a matriz olha se o `id` é 1 em uma consulta e se o `nombre` é `matriz` em um cadastro, não se os quatro campos têm o tipo que o esquema diz. Um servidor que devolvesse `limite_ms` como texto passaria. Para fechar isso é preciso um validador de JSON Schema (nenhum nas dependências do curso) e é a extensão natural da matriz.

**4. Não confere os cabeçalhos dos avisos de versão.** O documento promete `Deprecation`, `Sunset` e `Link` em `/v1`, e essa promessa foi conferida à mão em 8.13 e na Lição 3; a matriz de 23 cenários não tem um cenário para `/v1`.

**5. Os cenários compartilham um servidor com estado.** A ordem está escrita (seção 8.6.2), e uma mudança que reordene os cenários pode quebrá-los por razões que não são defeitos da API.

**6. A contagem de vazamentos é uma lista de sinais, não uma prova de ausência.** Cobre stack traces, caminhos de arquivos, SQL, credenciais e nomes de exceções de JavaScript, e deixa de fora tudo o que não foi imaginado.

**7. É um teste, e os testes também falham sem motivo.** Esta merece um lugar à parte, porque é o que mais desgasta a confiança em qualquer verificação automática. Durante esta lição uma das verificações da matriz falhou às vezes sem que houvesse nenhum defeito, e a história completa (como foi encontrada, como foi medida e como foi fechada) está na seção seguinte.

#### 8.14.1 Uma verificação que falha às vezes: assim a encontramos, assim a medimos e assim a fechamos

**Como a encontramos.** Enquanto esta lição era escrita, a matriz saiu algumas vezes com código `1` sem que nada estivesse quebrado. Eram execuções de trabalho, algumas contra cópias com defeitos de propósito, e a contagem delas não foi guardada: por isso aqui não há um número de quantas vezes falhava, e tudo o que segue é o que foi medido depois, com programas e saídas que estão no repositório. Uma das verificações que falhou foi a do corpo de mais de 16 KiB (a linha é de uma dessas execuções de trabalho; não foi guardada em um arquivo):

```text
FALLA cuerpo de más de 16 KiB: 413 (con Content-Length y por partes); en el tope, 400; el revisor sigue vivo: 20000 bytes por partes: error TypeError: fetch failed
```

Outra falha foi de outra família: uma requisição a um gateway que ainda não estava escutando (`pasarela sin revisor: 0 null`). Essa é retomada no final desta seção.

**Como a medimos.** Uma verificação que falha de vez em quando se mede melhor isolando-a. O `fig08_05.ts` repete 400 vezes exatamente o corpo em partes que a matriz manda (20 pedaços de 1000 bytes, sem `Content-Length`) e conta o que aconteceu a cada vez. É preciso o `revisor` escutando: `node servidor.ts` a partir de `fig08_01/`, em um terminal, e em outro. Esta é a execução contra o `revisor` **como estava antes de fechar a condição de corrida**, que é o conteúdo de `defectos/cierre-brusco/respuestas.ts` (testa-se copiando `fig08_01/` para outra pasta e substituindo esse arquivo; a saída completa está em `defectos/cierre-brusco.salida.txt`):

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

De 400 tentativas, o `revisor` respondeu `413` na maioria; nas demais o cliente não recebeu resposta: `EPIPE` (a conexão se rompeu enquanto o cliente ainda escrevia) e algumas vezes `ECONNRESET`. Com a primeira execução e as suas cinco repetições, o `revisor` respondeu entre 346 e 382 vezes `413` de 400: entre 18 e 54 tentativas sem resposta, ou seja, entre 4,5 e 13,5 de cada 100. O número muda de uma execução para outra, e isso é parte do que a tornava difícil de ver: na matriz, que faz *uma* tentativa por execução, manifestava-se como uma falha ocasional.

**A causa.** É uma condição de corrida, e a descreve o RFC 9112, seção 9.6. O `revisor` decide que o corpo é grande demais assim que conta mais de 16 KiB, responde `413` com `Connection: close` e fecha. Mas o cliente continuava mandando pedaços. Quando uma conexão é fechada por completo e ainda chegam dados, o sistema operacional responde com um *reset* (RST), e o reset pode apagar a resposta que o cliente ainda não tinha lido. O RFC diz assim: se um servidor fecha de imediato uma conexão TCP, “há um risco significativo de que o cliente não consiga ler a última resposta HTTP” (tradução nossa). E descreve o que os servidores costumam fazer para evitá-lo, que é **fechar por etapas**: primeiro se fecha só o lado da escrita (*half-close*), depois se **continua lendo** até que o cliente feche (ou até haver razoável certeza de que o cliente recebeu a última resposta), e no final se fecha por completo. Repare na ordem: o RFC responde **primeiro** e continua lendo **depois**.

**Como a fechamos, da primeira vez.** Há três saídas possíveis, e só uma é honesta com o servidor. **Repetir o teste** até passar oculta um defeito que existe. **Aceitar os dois desfechos** no teste (um `413` ou um fechamento) deixa de depender da corrida, mas dá por bom um servidor que perde respostas. **Corrigir o fechamento no servidor** conserta o problema onde ele está. A primeira tentativa foi a versão mais simples de escrever em Node: **ler e descartar o que o cliente continuar mandando, com um limite, e só então responder**. É o conteúdo de `defectos/drenar-antes/respuestas.ts` (a lição já não o usa, mas é conservado porque o seu limite foi medido):

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

Leia com calma, porque cada linha tem uma razão:

- **O motivo está no comentário**: continuar lendo e descartando o que chegar evita o RST. Mas atenção à ordem: esta versão lê **antes** de responder, e o RFC pede responder **primeiro**. Por isso o `413` demora: sai quando o cliente termina de mandar ou quando os limites são ultrapassados.
- **`DRENAR_MAX_BYTES` (1 MiB) e `DRENAR_MAX_MS` (2 segundos)** são os limites. Sem eles, o servidor leria para sempre um corpo que já decidiu rejeitar, e cederia a conexão a quem quiser retê-la mandando sem parar. Com os limites, o pior que se paga é 1 MiB e 2 segundos por conexão.
- **`fin` é o único caminho de saída**, e é chamada de quatro lugares: o corpo termina (`end`), a conexão se fecha (`close`), há um erro, ou os limites são ultrapassados. Ao sair, remove todos os ouvintes e desliga o relógio.
- **`peticion.resume()`** põe a requisição para ler. Os dados chegam ao ouvinte `data`, que só conta os bytes e os descarta.

Com corpos como o da matriz (20 KB) funcionou: 400 de 400. Mas tem um limite que foi medido, não suposto. O `fig08_05.ts` aceita um segundo argumento, o número de pedaços de 1000 bytes (por padrão 20), e foi executado contra essa cópia com corpos de 1 MB, de 1,1 MB e de 3 MB, 100 tentativas cada um (`defectos/drenar-antes.salida.txt`):

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

Até 1 MB, as 100 tentativas recebem o seu `413`. Assim que o corpo passa de 1 MiB (1 048 576 bytes) depois do limite, o servidor deixa de ler, responde e fecha, e o cliente, que continua escrevendo, volta a receber o RST: **a condição de corrida reaparece** e com 3 MB nenhuma tentativa recebe resposta. A primeira correção não fechou a corrida: a moveu para além do limite. Um cliente que manda mais de 1 MiB é, além disso, o que mais provavelmente errou por muito.

**Como a fechamos, da segunda vez: o fechamento em etapas que o RFC pede.** O que é preciso é o que o RFC descreve: responder **de imediato**, fechar só a escrita e continuar lendo. O Node não faz isso sozinho: com `Connection: close`, ao terminar de responder chama `socket.destroySoon()`, que fecha e destrói o socket (dá para ver em `lib/_http_server.js`; o método está documentado em [`net`](https://nodejs.org/docs/latest-v24.x/api/net.html#socketdestroysoon)). Esta é a versão que a lição traz:

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

- **`socket.destroySoon = …`** altera esse método **somente nesta conexão**, para que ao terminar de responder faça apenas `socket.end()`: fecha a escrita (*half-close*) e deixa a leitura aberta.
- **`peticion.resume()`** continua lendo e descartando o que o cliente mandar. Já não há um limite de bytes: o que se paga por uma conexão assim é, no máximo, **2 segundos** de leitura.
- **O relógio de 2 segundos** destrói a conexão mesmo que o cliente não feche, para que ninguém a retenha; `socket.once("close", …)` o desliga se a conexão terminou antes.
- **O `413` sai de imediato**, porque `leerCuerpo` chama `cerrarConCalma` e rejeita na hora, sem esperar nada.

Um limite que convém dizer: que o `http` use `destroySoon` ao fechar é um detalhe de como o Node é feito, não uma promessa da documentação dele. Se uma versão posterior o mudasse, o `fig08_05.ts` perceberia (a medição abaixo cairia de 400), e por isso a medição faz parte da lição e não só do texto.

**Como conferimos que ficou fechada.** O mesmo `fig08_05.ts`, desta vez contra o `revisor` de `fig08_01/` tal como está na lição (`fig08_05.salida.txt`), e depois com os corpos grandes que quebraram a primeira correção (`fig08_05.limite.salida.txt`):

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

Quatrocentos de quatrocentos nas seis execuções, contra entre 346 e 382 antes; e cem de cem com corpos de 1 MB, 3 MB e 20 MB, onde a primeira correção dava zero de cem. Esse é o controle: com o código velho, a medição vê o defeito; com o novo, não. O que **não** foi medido: o que acontece com um cliente lento que mande a conta-gotas por mais de 2 segundos (o servidor destrói a conexão; a resposta já saiu no começo, e se o cliente a leu antes do reset é questão do ritmo dele), nem quanta carga muitas conexões assim acumulam ao mesmo tempo.

**A outra família: a inicialização.** A outra falha, a do gateway, não tinha a ver com o fechamento e sim com a inicialização. A matriz esperava um tempo fixo depois de subir cada processo (um segundo o `revisor`, meio segundo o gateway). Uma espera fixa é uma aposta sobre quanto demora a inicialização, e essa duração não é constante. O `fig08_06.ts` mede a margem: sobe o gateway 100 vezes e anota quanto demora para responder; nas execuções guardadas (`ejercicios/ej6.salida.txt`) o máximo foi de 225 ms com a máquina livre e de 166 ms com 20 processos girando, muito abaixo dos 500 ms da espera. Ou seja, quase sempre sobra margem, mas a espera fixa só é boa enquanto a inicialização for mais curta que ela, e isso é justamente o que não se controla. Para ver a falha de propósito, `ejercicios/ej6/arranque-lento.sh` faz uma cópia de uma pasta e atrasa em 700 ms a inicialização de `servidor.ts` e de `pasarela.ts`: com a matriz de esperas fixas (`defectos/espera-fija/matriz23.ts`) sai `40 de 41`, e a verificação que falha é exatamente a que foi vista, `pasarela sin revisor: 0 null`; com a matriz da lição sai `41 de 41`.

O remédio é o que tinha sido anunciado: esperar que a porta aceite conexões em vez de esperar um número de milissegundos. É o que fazem as duas funções do começo de `matriz23.ts` (e disso trata o exercício 6):

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

`esperarPuerto` pergunta a cada 100 ms, por até 10 segundos, e **lança um erro** se o prazo passa ou se o processo que foi subido já saiu (por exemplo, por uma porta ocupada); terminar em silêncio deixaria a matriz medindo ninguém. `arrancar` confere **antes** que a porta esteja livre: sem isso, um `revisor` velho que já escuta faria `esperarPuerto` dar por bom um processo novo que morreu com `EADDRINUSE`. Com as duas, a matriz da lição, rodada 30 vezes seguidas com `fig08_08.sh` (`fig08_08.salida.txt`), saiu com código `0` nas 30 vezes, em uma máquina de uso normal. Isso não prova que não possa voltar a falhar; prova que o caso que se sabia falhar já não falha, e que agora, se um processo não inicia, a matriz diz isso em vez de medir outra coisa.

### 8.15 O `revisor` completo

Estes são todos os arquivos de `fig08_01/`. Os que mudam ou nascem nesta lição vêm primeiro; os demais são os das lições anteriores na sua versão vigente, e estão aqui para que seja possível montar a pasta completa mesmo sem ter feito as lições anteriores. O nome da pasta, `fig08_01`, aparece na primeira linha de cada arquivo, como nas lições anteriores. O documento é o único que não a leva, porque o JSON não admite comentários.

#### 8.15.1 Os arquivos que mudam ou nascem

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

**`fig08_01/openapi.json`** (o JSON não admite comentários, então este arquivo não começa com a linha de sempre):

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
            "description": "http o https; no puede apuntar a direcciones privadas ni reservadas (SSRF)."
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

#### 8.15.2 Os arquivos que não mudam

São os das lições anteriores na sua versão vigente; só muda a primeira linha, que agora diz `fig08_01/`. O `package.json` é o mesmo de sempre:

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


### 8.16 Revisar os tipos com `tsc` (opcional)

A partir da pasta do `revisor`, com o comando da seção 0.9 da Lição 0 mais `--allowImportingTsExtensions`:

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

Os programas avulsos desta lição (`fig08_02.ts`, `fig08_04.ts`, `fig08_05.ts`, `fig08_06.ts` e `fig08_07.ts`, e as variantes de `ejercicios/`) são revisados da mesma forma a partir da pasta que os contém, apontando para o `tsc` instalado em `fig08_01/`.

## O erro que a gente vai ver

### A matriz que se ajustou ao defeito

O erro mais tentador com uma verificação que fica vermelha é consertá-la no lugar errado. É terça-feira, a matriz está vermelha em 17 linhas, há pressa, e alguém abre `matriz23.ts` em vez de `problemas.ts`: “já não exigimos `Retry-After`”, “aceitamos `application/json` onde se esperava `application/problem+json`”. Duas linhas, e a matriz volta ao verde. É uma versão copiada de `matriz23.ts` com exatamente essas duas mudanças (em três lugares, porque a verificação do `429` por credencial também pergunta por `Retry-After`) a que está em `defectos/matriz-bendice/`. Copie-a sobre a pasta `rota/` da seção 8.10.1 (a do servidor “limpo”) e rode-a:

```text
$ node matriz23.ts   # la matriz «arreglada», contra el servidor con el defecto
ok    ETag tras reiniciar el revisor: la vieja no coincide (200, no un 304 falso)

41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
(código de salida: 0)
```

Verde. **41 de 41** e código de saída `0`, contra o mesmo servidor que há pouco deixou a matriz em 17 linhas vermelhas. O servidor não mudou; mudou a régua. É o que o curso chama de um teste que **abençoa o defeito**: passa, e o que passa é o erro.

Isso é pior que um teste que falha, por uma razão concreta: um teste vermelho chama a atenção de alguém, e um verde a tira. A partir desse momento, o painel diz “tudo bem”, e os integradores da cena do começo voltam a receber `application/json`. O defeito já não tem quem o vigie.

Três hábitos o evitam, e os três são baratos:

- **Uma mudança no que o teste espera é uma mudança de promessa.** É revisada como se revisa uma mudança na API: quem ficou sabendo? O documento diz o mesmo? Aqui, o `openapi.json` continua dizendo `application/problem+json`; a matriz ajustada já não coincide com o documento, e essa discrepância deveria ser a primeira coisa que alguém nota.
- **Antes de afrouxar um teste, pergunte qual dos três mente.** O servidor, o documento ou o teste. Com 17 linhas vermelhas com quase a mesma frase, o mais provável é que tenha mudado uma coisa no servidor, não 17 coisas no teste.
- **Reverta e confira que fica vermelho.** É a regra de toda a lição: um teste que não foi visto falhando contra o defeito não demonstra nada. Aqui, rodar a matriz **original** contra o servidor com o defeito dá vermelho; rodar a ajustada, verde. A diferença entre as duas é toda a informação.

### O servidor que ficou aberto

O segundo erro não é de desenho, é de esquecimento, e tem consequências sutis. A matriz sobe o seu próprio `revisor` na porta 18080. Mas se já houver um escutando ali (um `revisor` de uma lição anterior, ou a cópia `rota/` da seção 8.10 que não foi desligada), o programa novo não consegue ocupar a porta, e não há quem diga: os filhos são iniciados com `stdio: "ignore"`. A versão da matriz que não se defendia disso seguia em frente medindo o servidor velho. A da lição se defende: antes de subir qualquer coisa, confere as três portas. Para ver isso, deixe rodando em um terminal o servidor da cópia `rota/`, o “limpo”, e em outro rode a matriz **de `fig08_01/`**, a boa; depois, a versão anterior da matriz (`defectos/espera-fija/matriz23.ts`, que não tem a porta de entrada):

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

Quando terminar, desligue o servidor de `rota/` pelo PID (`kill %1` se foi lançado nesse mesmo terminal com `&`) e confira com o comando abaixo que as portas ficaram livres. A primeira matriz se recusa a medir: diz que porta está ocupada e sai com `2`, que é um código distinto do `1` de “algo falhou”. A segunda mostra o que acontecia antes. A pasta `fig08_01` não tem o defeito, mas a matriz anterior mostra as mesmas dezesseis linhas vermelhas dos cenários da seção 8.10.1. Quem a lesse sem saber do servidor aberto iria procurar o erro no código errado: a matriz não mediu o seu próprio `revisor`, mediu o que já estava lá.

E repare em como terminava, porque era a segunda metade do problema: **não imprimia o resumo**. A última linha da saída acima (“ESTADO: …”) não foi escrita pela matriz e sim pelo script que a rodou para esta lição: a matriz ficou esperando, sem dizer nada, e aos 60 segundos foi interrompida pelo PID. Ficava esperando porque uma das suas verificações adicionais desliga “o seu” `revisor` para testar o gateway, e espera o aviso de que terminou; esse `revisor` nunca chegou a existir, então o aviso não chegava. Um programa que fica mudo diante de uma porta ocupada, em vez de dizer “a porta 18080 está ocupada”, é um defeito, e por isso a matriz da lição traz a porta de entrada que o `fig08_03.sh` já tinha (seção 8.9). O que não muda é a regra de fundo, a que o curso repete desde a Lição 0: `127.0.0.1:18080` não diz o que há por trás, só que algo respondeu. Quem escrever o próprio programa que sobe processos deve dar a ele a mesma porta de entrada, e quem o rodar à mão deve conferir antes que as portas estejam livres:

```bash
for p in 18080 18081 18082; do (exec 3<>/dev/tcp/127.0.0.1/$p) 2>/dev/null && echo "ocupado: $p"; done
```

Se o comando não imprimir nada, as três portas estão livres.

## O que se faz errado

**Documentar de memória.** Um documento escrito do que se acredita que a API faz acaba descrevendo a API que se imaginou. Escreve-se olhando as respostas reais, e depois confere-se com a matriz.

**Documentar só o caminho feliz.** Um documento com os sucessos e sem os erros deixa para o cliente metade do trabalho: ele tem que descobrir os `4xx` e os `5xx` por tentativa e erro. Os erros são documentados com a mesma precisão que os sucessos, com o seu tipo de conteúdo e os seus cabeçalhos.

**Escrever a mesma resposta de erro em cada operação.** Ela se dessincroniza assim que alguém corrige uma e não as outras. As respostas de erro são escritas uma vez em `components` e reutilizadas com `$ref`.

**Colocar o tipo de conteúdo como cabeçalho.** Um `Content-Type` em `headers` é ignorado; o tipo vai como chave de `content`.

**Confundir `info.version` com a versão da API.** É a versão do documento. Se for preciso dizer qual é a API vigente e quais estão retiradas, escreve-se na descrição e marca-se `deprecated` nas rotas.

**Dar um documento por bom porque o validador diz “válido”.** O validador responde se está bem escrito, não se é verdade (seção 8.11).

**Testar só os códigos.** É a cena do começo. O código é o mais fácil de testar e o único que os testes daquela manhã conferiam.

**Afrouxar um teste para deixá-lo verde.** Um teste que se ajusta ao defeito passa, e o que passa é o defeito (seção “A matriz que se ajustou ao defeito”).

**Medir o servidor errado.** Uma porta ocupada por um programa velho deixa um programa medindo o que não é dele; por isso a matriz confere as portas antes de iniciar e sai com `2` se alguma responde (seção “O servidor que ficou aberto”).

**Repetir um teste até passar.** Uma verificação que falha às vezes tem uma causa. Entendê-la (seção 8.14.1) é mais barato que desconfiar de todas as outras.

**Validar o destino e deixar que outro resolva o nome.** São duas resoluções e entre uma e outra o nome pode mudar de dono. O endereço que se valida é o endereço ao qual se conecta.

**Confiar em que o documento afasta quem não deveria lê-lo.** Um documento OpenAPI quase sempre é publicado. O que não pode estar nele (nomes de máquinas internas, endereços privados, exemplos com dados reais) não se escreve, nem sequer como exemplo.

## Exercícios

Os seis se corrigem sozinhos: cada um termina com uma execução que diz se acertou (no 5 e no 6, com um controle que falha de propósito). Escreva a sua previsão na [bitácora](bitacora.md) **antes** de rodar qualquer coisa. Para os exercícios 1 a 3 é preciso a pasta `fig08_01/` e as portas 18080, 18081 e 18082 livres (a terceira é usada pelo gateway de uma das verificações adicionais); para o 4, a 18081 e o `::1`.

### Exercício 1 — Feche a lacuna do catálogo

A seção 8.5 encontrou que o `fig08_02.ts` marca uma lacuna: o documento não menciona o `type` `revision-inexistente`, e a rota `GET /revisiones/{id}` o devolve. Corrija uma **cópia** do `openapi.json`: acrescente uma resposta reutilizável para o `404` dessa rota, dê a ela o nome que quiser, e faça a operação apontar para ela. Para saber se acertou, rode os três verificadores com a cópia: o `fig08_02.ts` tem que dizer “0 con un hueco en el documento”; o `matriz23.ts` tem que continuar em 41 de 41; e o `redocly lint` tem que continuar dizendo “valid”. Preveja antes: quantos avisos o validador vai dar, mais, menos ou os mesmos?

### Exercício 2 — Faça a matriz ver `detail` e `instance`

A seção 8.14 disse que a matriz só confere três dos cinco membros de um Problem Details. Acrescente duas linhas a `comprobar` para que também peça `detail` e `instance` como texto, em todos os erros. Preveja: com a matriz ampliada, quantas linhas vermelhas o `revisor` bom dá? Depois, copie `ejercicios/ej2/defecto-sin-instance/problemas.ts` sobre uma cópia de `fig08_01/` (é um servidor que esqueceu `instance`) e preveja duas coisas: quantas linhas vermelhas a matriz **original** dá contra esse servidor, e quantas a ampliada.

### Exercício 3 — Tire o `405` do documento

Esta foi a ideia da seção 8.4.4. Em uma cópia do `openapi.json`, apague a resposta `405` de `GET /servicios/{id}` e rode a matriz. Preveja: quantas linhas vermelhas? Qual é a mensagem exata? Depois rode o `redocly lint` sobre o mesmo documento: o validador detecta?

### Exercício 4 — Que `Host` o servidor recebe?

A seção 8.12.3 disse que o cliente se conecta ao endereço já validado, mas que o cabeçalho `Host` conserva o nome. Modifique o `fig08_04.ts` para que o “laboratório” imprima o `Host` que recebeu em cada requisição. Preveja: ao rodar a versão com `fetch`, o servidor que responde imprime algo? E ao rodar a da lição? Que valor tem `Host` nesse caso?

### Exercício 5 — Reproduza a condição de corrida e os dois fechamentos

A seção 8.14.1 contou uma condição de corrida, uma primeira correção com o seu limite e o fechamento em etapas. Reproduza-os. Copie `fig08_01/` para uma pasta `viejo/`, substitua `respuestas.ts` por `defectos/cierre-brusco/respuestas.ts`, inicie o `revisor` de `viejo/` e rode `fig08_05.ts` três vezes. Preveja primeiro: o número de respostas `413` vai ser o mesmo nas três? Qual vai ser a causa das que não recebem resposta? Depois pare esse `revisor`, repita com `defectos/drenar-antes/respuestas.ts` e rode `node fig08_05.ts 100 3000` (3 MB por tentativa): preveja quantas das 100 recebem o seu `413`. Por último repita esses 3 MB contra o `revisor` de `fig08_01/` tal como está. Pare cada `revisor` pelo PID antes de iniciar o seguinte. Responda com argumentos: por que a primeira correção falha acima de 1 MiB e a segunda não? O que se continua pagando na segunda? O que aconteceria se uma versão do Node deixasse de chamar `socket.destroySoon()` ao fechar?
### Exercício 6 — Feche a espera fixa

A seção 8.14.1 terminou com uma fragilidade que a matriz da lição já não tem: esperar um tempo fixo depois de subir cada processo. Aqui quem a conserta é quem acompanha, partindo da versão que a tem: `defectos/espera-fija/matriz23.ts`. Primeiro meça a margem com o `fig08_06.ts`, que sobe o gateway 100 vezes e diz quanto demora para responder. Depois copie `fig08_01/` para uma pasta `mia/`, ponha ali `defectos/espera-fija/matriz23.ts` e altere-a para que, em vez de esperar um tempo, espere que a porta aceite conexões (e falhe com uma mensagem se não aceitar). Para saber se acertou, rode `ejercicios/ej6/arranque-lento.sh` sobre uma pasta com essa matriz: atrasa em 700 ms a inicialização do `revisor` e do gateway. Preveja antes: quantas verificações passam com a espera fixa e quantas com a sua? Quanto acha que o gateway demora para responder, na pior das 100 inicializações? Por último, rode a sua matriz oito vezes seguidas com a máquina saturada (por exemplo, com o dobro de programas `node -e 'while(true){}'` do que a CPU tem de núcleos, que serão parados pelo PID ao terminar).

## Soluções

### Solução 1

A solução está em `ejercicios/ej1/openapi.json`. Acrescenta uma resposta `E404Revision` junto a `E404`, com a descrição “La revisión no existe (type revision-inexistente).” e o mesmo conteúdo, e faz `GET /revisiones/{id}` apontar para ela:

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

As três execuções, com esse documento:

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

O `fig08_02.ts` passa de uma lacuna a **zero lacunas**; a matriz continua em 41 de 41, porque a mudança não tira nada do que a matriz procura; e o validador continua dizendo “valid” com **os mesmos 26 avisos**: foi acrescentada uma resposta que sim é usada, então não há componentes sem uso nem operações novas. Se a previsão foi de mais avisos, provavelmente se pensou que toda adição soma ruído; aqui não soma, porque o validador só conta o que não está completo.

### Solução 2

As duas linhas estão em `ejercicios/ej2/matriz23.ts`, logo abaixo da que pede `title`:

```ts
      if (typeof cuerpo.title !== "string") fallas.push("falta title");
      if (typeof cuerpo.detail !== "string") fallas.push("falta detail");
      if (typeof cuerpo.instance !== "string") fallas.push("falta instance");
```

Duas linhas que agora pedem `detail` e `instance` como texto. As três execuções:

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

A primeira execução é a importante: **a matriz original, contra um servidor ao qual falta `instance` em todos os seus erros, dá 40 de 41**. A única linha vermelha é a do `500`, porque esse cenário já pedia que `instance` fosse um `urn:uuid`; os outros 15 erros com o defeito passaram. É isso que significa “o teste não olha o que não olha”. A segunda execução confirma que a matriz ampliada continua em 41 de 41 com o servidor bom (nada do que foi acrescentado quebra o que já funcionava). A terceira é o controle positivo: contra o servidor com o defeito, a matriz ampliada marca os **16 cenários de erro**, um por cada erro, até ficar em 25 de 41. É a lição da seção 8.10 aplicada a um teste seu: ampliou-se uma régua e viu-se ela morder.

Se a previsão da terceira foi diferente, conte os cenários que são erros: dezesseis dos 23 códigos o são (do `400` ao `504`), e as verificações adicionais não passam por `comprobar`, então não são contagiadas.

### Solução 3

O documento sem o `405` se constrói com uma linha de Node sobre uma cópia:

```bash
node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync("openapi.json","utf8")); delete d.paths["/servicios/{id}"].get.responses["405"]; fs.writeFileSync("openapi.json", JSON.stringify(d,null,2)+"\n");'
```

Roda-se dentro da pasta da cópia, e depois a matriz e o validador:

```text
$ node matriz23.ts   # sin el 405 de GET /servicios/{id} en el documento
FALLA 405 método no admitido: openapi.json no documenta 405 en GET /servicios/{id}

40 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).

$ npx redocly lint openapi.json --format=stylish   # el mismo documento
Woohoo! Your API description is valid. 🎉
You have 26 warnings.
```

Uma linha vermelha na matriz, com a mensagem exata da seção 8.6.3: `openapi.json no documenta 405 en GET /servicios/{id}`. E o validador, que olha o documento sem saber nada do servidor, o dá por válido: não há nenhuma regra que diga “uma operação tem que declarar um `405`”. É a tabela de 8.11.3 em uma linha. Se na execução da matriz aparecer uma segunda linha vermelha (a verificação do corpo em partes), é a condição de corrida da seção 8.14.1 e não tem a ver com a mudança feita.

### Solução 4

A variante está em `ejercicios/ej4/fig08_04.ts`. Muda uma única coisa, o “laboratório”:

```ts
const laboratorio = createServer((p, r) => {
  console.log(`  el laboratorio recibió Host: ${p.headers.host ?? "(ninguno)"}`);
  r.writeHead(200);
  r.end();
});
```

E a execução, com a versão da lição:

```text
$ node fig08_04.ts fig08_01   # la variante del ejercicio 4
$ consultar("http://rebote.ejemplo:18081/")   con el cliente de fig08_01
  pregunta 1 al DNS: rebote.ejemplo -> 127.0.0.1
  el laboratorio recibió Host: rebote.ejemplo:18081
{"tipo":"respuesta","codigo":200,"ms":4,"reintentarEn":null}
el DNS fue preguntado 1 vez
```

O laboratório recebeu `Host: rebote.ejemplo:18081`: o nome da URL, com a sua porta, embora a conexão tenha ido a `127.0.0.1`. É o que faz a opção `lookup`: decide **aonde** se conectar e não toca em **o que se diz** depois de conectado. Com o cliente do `fetch` (`con-fetch`) o laboratório não imprime nada, porque a conexão não chegou a ele: chegou ao servidor de `299`, que não imprime. Se a previsão foi que o `Host` seria `127.0.0.1:18081`, pensou-se que quem se conecta a um IP o usa também como nome; é assim que funciona uma requisição escrita à mão com o IP na URL, e por isso o cliente da lição não escreve o IP na URL.

### Solução 5

Os números estão em quatro arquivos: `defectos/cierre-brusco.salida.txt` (o fechamento brusco), `defectos/drenar-antes.salida.txt` (descartar o corpo antes de responder), `fig08_05.salida.txt` e `fig08_05.limite.salida.txt` (o fechamento em etapas). O fechamento brusco:

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

Com o código brusco, o número de `413` muda de uma execução para outra (a corrida depende de como o tempo se reparte entre o fechamento do servidor e a escrita do cliente) e não chega a 400 em nenhuma; as que faltam terminam em `EPIPE`, com alguns `ECONNRESET`. A primeira correção, com 400 tentativas de 20 KB e depois com corpos maiores:

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

Até 1 MB, 100 de 100; com 1,1 MB, 8 de 100; com 3 MB, 0 de 100. E o fechamento em etapas, com os corpos de sempre e com os grandes:

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

**400 de 400** nas seis execuções, e **100 de 100** com 1 MB, 3 MB e 20 MB.

Sobre as diferenças. A primeira correção **lê antes de responder** e tem um limite de 1 MiB: acima do limite responde e fecha de uma vez, então o cliente que continua escrevendo volta a receber o RST e perde o `413`; o limite moveu a corrida, não a fechou. A segunda faz o que o RFC 9112 descreve: **responde de imediato**, fecha só a escrita (`socket.end()`) e continua lendo e descartando o que chegar, de modo que o cliente pode ler o `413` mesmo continuando a mandar, até os 2 segundos do relógio. O que se continua pagando: durante esses 2 segundos o servidor lê o que o cliente quiser mandar (já não há limite de bytes). O que depende do Node: que o `http` chame `socket.destroySoon()` ao fechar uma resposta com `Connection: close`; se deixasse de fazê-lo, a substituição não seria executada e a medição cairia de 400, que é a razão de tê-la.

### Solução 6

A solução está no próprio `fig08_01/matriz23.ts` (`ejercicios/ej6/matriz23.ts` é o mesmo): duas funções no começo do arquivo que substituem as quatro esperas fixas que havia depois de subir um processo.

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

`await esperar(500)` (o gateway) e os três `await esperar(1000)` (o `revisor`, duas vezes, e a matriz ao iniciar) passam a `arrancar("pasarela.ts", 18082)`, `arrancar("servidor.ts", 18080)` e a `esperarPuerto(18081, …)` e `esperarPuerto(18080, …)` com a porta que corresponder; e no começo da execução, uma porta de entrada que sai com `2` se alguma das três portas já responde. As medições, todas guardadas em `ejercicios/ej6.salida.txt` (ali `espera-fija/` é uma cópia de `fig08_01/` com `defectos/espera-fija/matriz23.ts` por cima, e as portas foram reescritas como no resto da lição):

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

Leia com cuidado, porque o que diz e o que não diz importam igualmente. A primeira parte dá a margem: quanto o gateway demorou para responder em 100 inicializações, e quantas passaram dos 500 ms que a matriz de esperas fixas esperava (e dos 1000 que esperava ao `revisor`). A segunda repete a medição com a CPU saturada. A terceira roda as duas matrizes oito vezes com esses processos girando.

O que **sim** foi medido: com a máquina saturada, nenhuma das duas matrizes falhou, e as inicializações couberam na espera; saturar a CPU não bastou para provocar a falha (o sistema operacional costuma dar prioridade a um processo recém-criado), de modo que esse experimento não distingue as duas matrizes. O que as distingue é o **controle negativo**, e esse sim é reproduzível: com a inicialização atrasada 700 ms de propósito, a matriz de esperas fixas dá `40 de 41`, com a falha `pasarela sin revisor: 0 null` que foi vista durante a lição, e a matriz com `esperarPuerto` dá `41 de 41`. E se algo já ocupa uma porta, a matriz diz isso e sai com `2` sem medir. Uma ressalva: o atraso de 700 ms foi escolhido por nós para ficar entre as duas esperas fixas (500 e 1000 ms). Que a espera por porta aguente é raciocínio mais medição; não prova que nenhuma inicialização, em nenhuma máquina, demore mais que os 10 segundos que ela concede.

## Encerramento do curso: como saber que terminou

O README do curso prometeu cinco coisas que a API tem que cumprir ao terminar. Com esta lição, as cinco são verificáveis, e aqui está o que verifica cada uma:

| Promessa do curso | O que a verifica |
|---|---|
| A matriz de 23 cenários roda com um único comando, e cada linha confere código, cabeçalhos, tipo de conteúdo e corpo | `node matriz23.ts` (seção 8.7) |
| Nenhuma resposta de erro é `200` nem HTML; todas são `application/problem+json` com um `type` estável | o tipo de conteúdo e o `type` de cada cenário (8.6.3) e o cruzamento do catálogo (8.5) |
| Nenhum corpo de um `5xx` contém stack traces, consultas, caminhos nem chaves | a lista de vazamentos dos `5xx` (8.6.4), com as ressalvas de 8.14 |
| Um `POST` repetido com a mesma chave não duplica nada; com outro corpo, `422`; em andamento, `409` | a verificação adicional 1 (8.8) e `fig06_03.ts` da Lição 6 |
| O `revisor` classifica os 23 casos com uma tabela e não repete o que não deve | `tabla23.ts` da Lição 7, que continua dando o mesmo depois de mudar `cliente.ts` |

Duas advertências de honestidade, porque este curso as repetiu: `Idempotency-Key` e os cabeçalhos `RateLimit-*` continuam não sendo um padrão (o rascunho do primeiro expirou em 18 de abril de 2026 sem ser publicado como RFC; o de `RateLimit-*` continua sendo um rascunho ativo da IETF), e uma matriz verde diz que **o que a matriz olha** está bem. O que ela não olha (seção 8.14) continua nas mãos de quem acompanha.

## Como sei que consegui

- [ ] Abrir o `openapi.json` e apontar as suas cinco peças: `info`, `servers`, `security`, `paths` e `components`; e explicar por que `info.version` não é a versão da API.
- [ ] Explicar por que as respostas de erro são escritas uma vez em `components` e reutilizadas com `$ref`, e dizer quantas referências há a quantas respostas (79 a 18).
- [ ] `node fig08_02.ts` marca uma lacuna (`revision-inexistente`) com o documento da lição, e zero lacunas com o do exercício 1.
- [ ] `node matriz23.ts` dá `41 de 41` e sai com `0`; com `defectos/sin-problem-json/problemas.ts` dá `24 de 41` e sai com `1`; com `defectos/sin-429-documentado/openapi.json` dá `40 de 41`.
- [ ] `bash fig08_03.sh` dá `23 de 23`, e explicar o que a versão com `curl` verifica a menos que a de TypeScript.
- [ ] Com o Redocly CLI, o documento dá “valid” com 26 avisos, o documento quebrado dá dois erros, e o documento sem o `429` também dá “valid”; e explicar por quê.
- [ ] `node fig08_04.ts con-fetch` chega ao servidor de `299` com duas perguntas ao DNS, e `node fig08_04.ts fig08_01` chega ao laboratório com uma; e dizer por que o certificado continua sendo verificado contra o nome.
- [ ] Explicar `Deprecation`, `Sunset` e `Link` com `rel="deprecation"`, e o que `deprecated: true` marca no documento.
- [ ] Dizer, com dois exemplos medidos, o que a matriz não consegue ver.
- [ ] `fig08_05.ts` dá 400 de 400 contra `fig08_01/` e menos de 400 contra o `respuestas.ts` de `defectos/cierre-brusco/`; com 3 MB (`node fig08_05.ts 100 3000`) dá 100 de 100 contra `fig08_01/` e 0 de 100 contra `defectos/drenar-antes/`; e explicar por que o que fecha a corrida é responder primeiro e fechar só a escrita.
- [ ] A matriz “ajustada” dá verde contra o servidor com o defeito, e explicar por que isso é pior que uma matriz vermelha.
- [ ] Ao terminar, nenhum programa fica escutando: `curl -i http://127.0.0.1:18080/` e `curl -i http://127.0.0.1:18081/` dão o erro 7.

## Resumo

Responda sem olhar a lição:

1. Quais são as cinco peças de um documento OpenAPI e o que contém cada uma? O que é `info.version`?
2. Para que serve `$ref`, e por que as respostas de erro vão em `components`?
3. Que quatro coisas uma resposta promete, e quais delas a “limpeza” do começo rompeu?
4. O que `comprobar` confere em cada cenário, em ordem? Por que junta todas as falhas em vez de parar na primeira?
5. O que é uma regressão, e quantas verificações adicionais a matriz tem?
6. O que diz um validador de OpenAPI e o que não diz? Que pergunta a matriz responde?
7. O que é um teste que “abençoa o defeito”? Como se evita?
8. O que é o *DNS rebinding*? Por que validar antes de cada conexão não o fecha, e o que o fecha?
9. O que faz a opção `lookup` e o que não faz? Por que `soloA` responde de duas maneiras?
10. O que dizem `Deprecation`, `Sunset` e `Link` com `rel="deprecation"`, e o que marca `deprecated: true`?
11. Nomeie três coisas que a matriz não vê.
12. Por que a verificação do corpo em partes falhava às vezes? Como foi medida e como foi fechada? Por que a primeira correção (descartar o corpo antes de responder) tinha um limite e o fechamento em etapas não?

## Fontes

Todas foram consultadas em 21 de outubro de 2026.

1. [OpenAPI Specification v3.1.1](https://spec.openapis.org/oas/v3.1.1.html) (24 de outubro de 2024): `info.version` como versão do documento (4.8.2.1), `servers` (4.8.1.1), o objeto de operação, `deprecated`, `security` e `operationId` (4.8.10.1), os objetos de rota (4.8.9.1), de parâmetro (4.8.12.2.1), de respostas e de resposta (4.8.16 e 4.8.17), de referência (4.8.23.1), de esquema (4.8.24) e as extensões com `x-` (4.9).
2. [Migrating from OpenAPI 3.0 to 3.1.0](https://www.openapis.org/blog/2021/02/16/migrating-from-openapi-3-0-to-3-1-0) (P. Sturgeon, 16 de fevereiro de 2021): o alinhamento com o JSON Schema 2020-12 e a substituição de `nullable` por uma lista de tipos.
3. [RFC 9457, *Problem Details for HTTP APIs*](https://www.rfc-editor.org/rfc/rfc9457.html) (julho de 2023, trilha de padrões; substitui o RFC 7807): os membros `type`, `title`, `status`, `detail` e `instance` (3.1), e os membros de extensão, que quem consome deve ignorar se não os reconhece (3.2).
4. [IANA, registro de `application/problem+json`](https://www.iana.org/assignments/media-types/application/problem+json): o tipo de conteúdo e a sua referência, o RFC 9457.
5. [RFC 9110, *HTTP Semantics*](https://www.rfc-editor.org/rfc/rfc9110.html): `Allow` no `405` (15.5.6), `Retry-After` no `503` (15.6.4).
6. [RFC 9112, *HTTP/1.1*, seção 9.6 (*Tear-down*)](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.6): o risco de fechar uma conexão de imediato e o fechamento por etapas.
7. [RFC 9745, *The Deprecation HTTP Response Header Field*](https://www.rfc-editor.org/rfc/rfc9745.html) (março de 2025, trilha de padrões): `Deprecation` como data de campo estruturado, a relação com `Sunset` e a relação `deprecation` de `Link`.
8. [RFC 8594, *The Sunset HTTP Header Field*](https://www.rfc-editor.org/rfc/rfc8594.html) (maio de 2019, informativo): o formato e que as datas são dicas.
9. [Node.js, `net.connect`](https://nodejs.org/docs/latest-v24.x/api/net.html): a opção `lookup` e `autoSelectFamily` (ativada por padrão desde a versão 20).
10. [Node.js, `dns.lookup`](https://nodejs.org/docs/latest-v24.x/api/dns.html): a opção `all` e a forma do *callback* em cada caso.
11. [Node.js, `http.request`](https://nodejs.org/docs/latest-v24.x/api/http.html): as opções `agent: false`, `lookup` e `signal`, e a mistura de `url` e `options`.
12. [Node.js 24.14.1 “Krypton” (LTS)](https://nodejs.org/en/blog/release/v24.14.1) (24 de março de 2026): a versão com que as saídas foram executadas.
13. [OWASP, *Server-Side Request Forgery Prevention Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): *DNS rebinding* e fixar a conexão, redirecionamentos, listas de permitidos em vez de listas de bloqueio.
14. [GHSA-489g-7rxv-6c8q](https://github.com/advisories/GHSA-489g-7rxv-6c8q) (10 de julho de 2026): *MCP Atlassian*, uma correção de SSRF incompleta por não fixar o IP validado; corrigido na versão 0.22.0.
15. [GHSA-9hgc-g3w5-67cm, CVE-2026-53708](https://github.com/advisories/GHSA-9hgc-g3w5-67cm) (15 de junho de 2026): *ContextForge*, uma condição de corrida entre a validação e a conexão em um ponto de acesso de administração; corrigido na versão 1.0.3. É a fonte primária que foi consultada: a página do NVD (nvd.nist.gov) deste CVE não devolveu conteúdo legível ao ser consultada.
16. [Redocly CLI, comando `lint`](https://redocly.com/docs/cli/commands/lint): o que faz, o conjunto de regras recomendado por padrão e os formatos de saída; a versão usada é a 2.57.0 (30 de setembro de 2026), de licença MIT.

### Termos desta lição

| | |
|---|---|
| **OpenAPI** | a especificação para descrever uma API HTTP em um documento que as máquinas leem; o curso usa a 3.1.1 |
| **operação** | um método sobre uma rota (`GET /servicios/{id}`) e tudo o que se diz dele |
| **`$ref`** | a referência a uma peça escrita em outro lugar do documento, normalmente em `components` |
| **validador (*linter*)** | o programa que diz se um documento está bem escrito segundo a especificação |
| **matriz** | a tabela de cenários percorrida com um único comando, comparando cada resposta com o prometido |
| **regressão** | um teste de algo que já foi corrigido uma vez, para que não volte sem que ninguém perceba |
| **que o teste morda** | demonstrar que um teste detecta um defeito desfazendo a correção e vendo-o em vermelho |
| **abençoar o defeito** | que um teste passe porque foi ajustado ao que está quebrado em vez de exigir o prometido |
| **DNS rebinding** | que um nome mude de endereço entre a verificação e a conexão, por uma resposta de DNS que mente na segunda vez |
| **TOCTOU** | *time of check, time of use*: uma condição de corrida entre quando algo é verificado e quando é usado |
| **`deprecated`** | o campo de uma operação que avisa que já não convém usá-la |
| **`Deprecation`, `Sunset`** | os cabeçalhos que dizem desde quando algo é descontinuado e quando se espera que deixe de responder |

---

Com esta lição termina o curso; segue a sua bitácora.

**Anterior:** [Lição 7 — Quem lê o erro: o cliente do `revisor` e os agentes de IA](07-quien-lee-el-error.md)

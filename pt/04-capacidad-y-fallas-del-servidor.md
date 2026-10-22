# Lição 4 — Capacidade e falhas do servidor: 429, 500, 502, 503 e 504

É sexta-feira, último dia do mês, e são 19h05. O serviço de faturamento da equipe `a` começou a responder coisas estranhas há vinte minutos, e o painel alimentado pelo `revisor` ficou vermelho. Alguém da equipe de pagamentos, nervoso, abriu o painel e clicou em «revisar agora» várias vezes seguidas; o navegador ficou repetindo a requisição a cada meio segundo, e cada repetição faz o `revisor` sair para a rede e consultar um serviço que ele já sabe que está fora do ar. Às 19h12, a pessoa de plantão pede o relatório do serviço de catálogo e recebe um `500` cujo corpo é um stack trace com a pasta completa do servidor, o nome de cada arquivo e a versão do Node em execução. Alguém copia esse corpo no canal público de suporte para pedir ajuda. Às 19h20 chega a pergunta que ninguém consegue responder: **a culpa é nossa ou deles?** O `revisor` responde `500` quando o próprio código falha, `500` quando o serviço de faturamento devolve lixo e `500` quando o de relatórios demora demais. Com um único número para três falhas distintas, ninguém sabe quem acordar.

Esta lição dá ao `revisor` um número diferente para cada uma dessas situações e o ensina a calar o que não deve sair.

**Tempo:** 2 × 45 min (o corte está entre as seções 4.4 e 4.5)

**O que se constrói:** a rede de segurança completa para o erro inesperado (um `500` com uma referência, e o stack trace apenas no terminal de quem opera), uma consulta em tempo real, `GET /servicios/{id}/salud`, em que o `revisor` faz o papel de gateway e distingue entre uma dependência lenta (`504`) e uma que não responde HTTP (`502`), um modo de manutenção que responde `503` com `Retry-After`, e um limite por credencial para tudo o que faz o `revisor` sair para a rede (as revisões e a consulta em tempo real), que responde `429`

**O que se aprende:** a responder, para cada falha, **quem tem a culpa e quem pode corrigi-la**; `Retry-After` nas duas formas, segundos ou data; `500` versus `502` versus `504`; `503` versus `500`; por que o `429` é um `4xx` mesmo falando de capacidade; **o que se diz e o que jamais se diz** em um erro do servidor (stack traces, consultas, caminhos, segredos); e, nos quadros de segurança, o que jamais se diz em um erro e o `429` como defesa contra a enumeração e o esgotamento de recursos, além de por que a força bruta sobre as credenciais é contida em outra camada

**De onde se parte.** Da [Lição 3](03-errores-del-cliente-estado.md), com um `revisor` que já distingue os erros de estado do cliente (não todo o registro de `4xx` da IANA, mas os que o curso trabalha): o conflito, a regra de negócio e a pré-condição, a atualização perdida, a versão aposentada. Esse `revisor` já não cai quando um handler lança uma exceção: desde a Lição 1, `atenderSinCaerse` a captura e responde `500 error interno`. Mas é uma rede de segurança mínima: o `500` não traz nada que permita encontrar o erro no terminal, e ninguém explicou ainda o que esse código significa. Também não há como colocá-lo em manutenção, nem como frear quem pede revisões sem parar, nem como perguntar em tempo real como está um serviço.

**O que esta lição não faz.** Não muda o formato dos corpos de erro: continuam sendo uma linha de texto, e a [Lição 5](05-problem-details.md) os converte em `application/problem+json`. Não reenvia nada: o `revisor` lê `Retry-After` e o anota no resultado de uma revisão, mas o backoff exponencial e a decisão de tentar de novo são da [Lição 6](06-reintentos-idempotencia.md), e a tabela que decide o que fazer com cada código é da [Lição 7](07-quien-lee-el-error.md). Não ensina os cabeçalhos `RateLimit-*`, porque ainda são um rascunho da IETF e não um padrão (seção 4.6.5). E não simula um balanceador de carga de verdade: o gateway desta lição é o próprio `revisor`, que consulta um serviço e conta o que aconteceu.

**Sobre as execuções.** O Linux Mint 22 é o sistema de referência do curso. As saídas desta lição foram obtidas em 21 de outubro de 2026 no macOS com Node 24.14.1 e curl 8.7.1, em uma máquina com o fuso horário do centro do México (UTC−6); apenas uma saída depende desse fuso, a do exercício 2, e a solução explica o motivo. A máquina tinha outros programas nas portas do curso, então o laboratório e o `revisor` foram iniciados nas portas 18481 e 18480, e nas saídas foram reescritas como 18081 e 18080; os comprimentos não mudam, porque os dois números têm cinco dígitos. Na execução local várias coisas vão mudar: a data do cabeçalho `Date`, a referência de cada `500` (um identificador aleatório, diferente a cada erro), os milissegundos medidos, os oito dígitos finais de cada `ETag` e o `Retry-After` de um `429`, que depende de quanto tempo se passou desde a primeira requisição da janela. Quando o terminal do `revisor` imprime um stack trace, a pasta da máquina aparece como `<carpeta>`: os caminhos de uma máquina não se publicam, e a seção 4.3.4 explica por quê. O `revisor` guarda tudo em memória: inicie-o de novo antes de cada série de requisições para obter o mesmo resultado da lição. Os programas estão em [`programas/04-capacidad-y-fallas-del-servidor/`](../programas/04-capacidad-y-fallas-del-servidor), no repositório do curso: o `revisor` em `fig04_01/`, a janela fixa vista de perto em `fig04_02.ts`, o leitor de `Retry-After` em `fig04_03.ts`, as versões quebradas de «O erro a ser observado» em `defectos/`, as soluções que levam código em `ejercicios/`, e cada execução em seu arquivo `.salida.txt`. Todos passam no `tsc` em modo estrito com o comando da seção 4.7.4.

## Ao terminar, será possível

- Dizer, para uma falha dada, quem tem a culpa, quem pode corrigi-la e qual código lhe corresponde: `429`, `500`, `502`, `503` ou `504`.
- Provocar um `500` no `revisor` e encontrar o stack trace no terminal a partir da referência que o cliente recebeu.
- Distinguir com uma execução um `502` de um `504`, e explicar por que um serviço fora do ar que responde `503` produz um `200` na consulta de saúde.
- Ler um `Retry-After` nas duas formas, segundos ou data HTTP, e apontar quais valores não são válidos segundo a RFC 9110.
- Explicar por que uma janela fixa de 3 requisições por segundo pode deixar passar 5 requisições em menos de 70 milissegundos, com a execução que o mostra.
- Enumerar o que jamais se diz em um erro do servidor e demonstrar com uma execução o que revela um stack trace que viaja no corpo.
- Demonstrar com uma execução que um limite por credencial, consultado antes de buscar o recurso, freia quem testa identificadores um após o outro, e que um limite por recurso não o freia.

## O porquê antes do como

Na Lição 0 apareceu a pergunta que separa as duas famílias de erros: **quem errou?** Se foi quem pediu, o código é um `4xx`; se foi quem atende, um `5xx`. As Lições 2 e 3 se dedicaram à primeira metade. Esta lição trata da segunda e acrescenta uma pergunta tão importante quanto a primeira: **quem pode corrigir?** Porque «a culpa é do servidor» não diz a ninguém o que fazer. O cliente precisa saber se vale a pena esperar, quanto, ou desistir. Quem opera precisa saber se o problema está no código, na configuração ou em um serviço de outra equipe. Cada código desta lição responde às duas perguntas de um jeito diferente:

| Código | O que aconteceu | Quem tem a culpa | Quem pode corrigir | O que o cliente faz |
|---|---|---|---|---|
| `429` | pediu-se mais do que cabe em um tempo dado | o cliente, pelo ritmo | o cliente, reduzindo o ritmo | esperar o que `Retry-After` indicar |
| `500` | algo inesperado aconteceu no código do servidor | o servidor | quem opera o servidor, corrigindo o código | não insistir no mesmo; informar a referência |
| `502` | o servidor atuou como gateway e o que está atrás respondeu algo inválido, ou não foi possível conectar | o que está atrás | quem opera o que está atrás | esperar, ou tentar mais tarde |
| `503` | o servidor não pode atender agora: manutenção ou sobrecarga | ninguém errou: é uma decisão ou um limite | o tempo, ou quem opera | esperar o que `Retry-After` indicar |
| `504` | o servidor atuou como gateway e o que está atrás não respondeu a tempo | o que está atrás | quem opera o que está atrás | esperar, ou tentar mais tarde |

A cena do início tinha três problemas, e os três cabem nesta tabela. O navegador que repetia a requisição a cada meio segundo precisava de um `429`, que dissesse «reduza o ritmo» e quanto esperar. O relatório que estourou precisava de um `500` que não contasse nada de dentro, mais uma referência para que a pessoa de plantão encontrasse o stack trace no terminal. E o faturamento fora do ar precisava de um `502` ou de um `504`, que dissessem «o problema está atrás de mim», para que ninguém revisasse o código do `revisor` procurando um erro que não estava ali. Com um único `500` para tudo, cada uma dessas pessoas tomou a decisão errada: o navegador continuou insistindo, o corpo do erro foi parar em um canal público, e o plantão procurou no lugar errado.

Observe a primeira linha: o `429` é um `4xx`, embora fale de capacidade. É a única exceção aparente da tabela, e não é uma exceção: quem pode corrigir é o cliente, reduzindo o ritmo, e é exatamente isso que a família `4xx` diz. O servidor não falhou; o cliente pediu mais do que o combinado. Já o `503` é um `5xx` ainda que o servidor «funcione»: o servidor não pode atender agora, por uma razão dele, e nenhuma mudança na requisição resolve.

A tabela tem outra coluna que não se vê, mas que atravessa toda a lição: **o que se diz**. Um erro do servidor é o momento em que uma API está mais tentada a contar demais, porque quem escreveu o código quer ver o que aconteceu, e o mais rápido é mandar a exceção completa na resposta. O que serve a quem opera (o stack trace, a consulta, o caminho do arquivo) é exatamente o que não deve ver quem fez o pedido. O terceiro princípio do curso diz: **o que sai para fora se projeta**.

A lição tem cinco partes:

1. **O laboratório e a pergunta** (4.1 e 4.2): as três formas como uma dependência falha sem responder, e a pergunta que decide o código.
2. **O `500`** (4.3): a referência, o stack trace no terminal e o quadro de segurança sobre o que jamais se diz.
3. **O `revisor` como gateway** (4.4): `502` e `504`, e por que um `503` alheio é um `200` próprio.
4. **A capacidade** (4.5 e 4.6): `503` com `Retry-After` para a manutenção e `429` para o limite de requisições, com o quadro de segurança sobre o `429` como defesa.
5. **O `revisor` completo** (4.7): os arquivos e a execução de todos os casos.

## Os conceitos

### 4.1 O `revisor` desta lição

#### 4.1.1 O que muda

O `revisor` desta lição vive em `~/curso-http/fig04_01/`. Quem tiver a pasta da Lição 3 deve copiá-la com esse nome. São treze arquivos: dois novos, seis que mudam e cinco que ficam como estavam. A seção 4.7 traz todos completos; aqui vai o mapa, para saber onde está cada coisa durante a leitura:

| Arquivo | O que muda | Seção |
|---|---|---|
| `limitador.ts` | **novo**: quantas vezes se pode fazer algo em uma janela de tempo | 4.6 |
| `operacion.ts` | **novo**: o modo de manutenção e `PUT /mantenimiento` | 4.5 |
| `servidor.ts` | a rede de segurança mínima se torna a completa: referência e stack trace recortado | 4.3 |
| `cliente.ts` | `consultar` distingue quatro desfechos mais um, e lê `Retry-After` | 4.4 e 4.5 |
| `servicios.ts` | as rotas `salud` e `informe`, e os limites de `pedirRevision` e `salud` | 4.3, 4.4 e 4.6 |
| `rutas.ts` | as rotas novas e a parada por manutenção | 4.5 |
| `laboratorio.ts` | três rotas para falhar: `/lento/MS`, `/cortar` e `/basura` | 4.1.2 |
| `almacen.ts` | mais três serviços de inicialização, e `revisionesDe` | 4.1.2 e 4.3 |

`autenticacion.ts`, `destinos.ts`, `etiquetas.ts`, `respuestas.ts` e `versiones.ts` não mudam. Os corpos de erro continuam saindo de `fallar`, em `respuestas.ts`, como uma linha de texto.

#### 4.1.2 Três formas de falhar sem responder

Para provocar um `502` e um `504` é preciso um serviço que falhe **sem** responder um código. Um serviço que responde `503` não serve para isso: ele respondeu, e a resposta é HTTP válido. O laboratório, que é o ambiente de testes da Lição 0 na porta 18081, ganha três rotas que falham das três formas como falha um serviço real quando não responde direito:

```ts
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
```

- `/lento/MS` responde `200`, mas depois de `MS` milissegundos. É o serviço que funciona, mas demora: um banco de dados saturado, um processo que ficou esperando por outro.
- `/cortar` fecha a conexão sem escrever nada. É o processo que caiu no meio da requisição, ou o balanceador que corta.
- `/basura` escreve uma linha que não é uma resposta HTTP. É o serviço que não fala o protocolo esperado: uma porta errada, outro programa escutando ali.

Antes de ver o que o `revisor` faz com elas, convém observar o que faz o `curl`, que é um cliente sem intermediários. Inicie o laboratório em um terminal (`node laboratorio.ts`, a partir de `fig04_01/`) e teste as três em outro:

```text
$ curl -i http://127.0.0.1:18081/basura
curl: (1) Received HTTP/0.9 when not allowed

$ curl -i -m 1 http://127.0.0.1:18081/lento/3000
curl: (28) Operation timed out after 1001 milliseconds with 0 bytes received

$ curl -i http://127.0.0.1:18081/cortar
curl: (52) Empty reply from server
```

Nenhuma das três traz uma linha de status. Nenhuma traz um código. O `curl` termina com um erro **próprio**, e cada um diz algo diferente. O 1 é, segundo o manual do `curl`, «protocolo não suportado», e a mensagem explica o motivo: o que `/basura` escreveu não começa com `HTTP/1.1`, então o `curl` o tomou por uma resposta HTTP/0.9 (sem linha de status nem cabeçalhos), e essa versão vem desativada, a menos que seja solicitada com `--http0.9`. Na prática: chegou algo, mas não é HTTP. O 28 diz que o tempo se esgotou: com `-m 1` foi dado um segundo, e `/lento/3000` ia demorar três. O 52 diz que o servidor não respondeu nada: aceitou a conexão e a fechou. Na Lição 0 apareceu o código 7, «não consegui conectar»: é a quarta forma, e ela será vista no exercício 4.

Quando o `revisor` consultar um desses serviços, estará no lugar do `curl`. A diferença é que o `curl` pode terminar com um código de saída, e o `revisor` não: alguém lhe fez uma requisição HTTP e ele precisa responder com um código HTTP. Esse é o problema que o `502` e o `504` resolvem.

Os serviços de inicialização do `almacen.ts` crescem para usar essas rotas. Aos três de antes (1 `catalogo`, 2 `pagos`, 3 `nomina`) somam-se mais três, todos da equipe a:

| id | nombre | url | límite |
|---|---|---|---|
| 4 | inventario | `http://127.0.0.1:18081/lento/1500` | 2000 ms |
| 5 | reportes | `http://127.0.0.1:18081/lento/3000` | 1000 ms |
| 6 | facturacion | `http://127.0.0.1:18081/basura` | 2000 ms |

`inventario` demora 1,5 s com um limite de 2 s: chega a tempo, mas lento. `reportes` demora 3 s com um limite de 1 s: não chega. `facturacion` responde lixo. Como agora há seis serviços de inicialização, o primeiro cadastro de cada execução recebe o id 7, não o 4.

#### 4.1.3 Iniciar os dois

Como nas lições anteriores, dois terminais em `~/curso-http/fig04_01/`:

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

Os dois devem ficar em execução. Todas as requisições das seções 4.3 a 4.6 vão contra esse par, na ordem em que aparecem, e a seção 4.7.3 as reúne.

### 4.2 Quem tem a culpa: a pergunta dos `5xx`

A RFC 9110 define a família `5xx` na sua [seção 15.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6) com uma frase que convém ler devagar: o servidor **sabe que errou, ou não é capaz** de executar o método solicitado. São duas coisas distintas. «Errou» é um erro: algo no servidor não fez o que devia. «Não é capaz» pode não ser erro de ninguém: o servidor está em manutenção, ou saturado, ou depende de outro que não responde. A mesma seção acrescenta uma recomendação forte (um *SHOULD*, não um *MUST*) que já apareceu na Lição 0: exceto em uma resposta a `HEAD`, o servidor **deveria** enviar uma explicação do erro e dizer **se é temporário ou permanente**. Essa segunda metade é a que quase todo mundo esquece, e é a que mais serve ao cliente, porque dela depende se vale a pena tentar de novo.

Para escolher entre os cinco códigos desta lição, fazem-se estas perguntas, em ordem:

1. **O cliente pediu mais do que lhe cabe em um tempo dado?** Então o servidor não falhou: o cliente precisa reduzir o ritmo. É um `429`, da família `4xx`, com `Retry-After` se for conhecido quanto ele precisa esperar.
2. **O servidor decidiu não atender agora, por manutenção ou porque está saturado?** É um `503`. Ninguém errou; é temporário por definição, e `Retry-After` diz quanto se espera que dure.
3. **O servidor estava atuando como gateway, e o que está atrás falhou?** Se o de trás não respondeu a tempo, é um `504`. Se respondeu algo que não é uma resposta válida, ou não foi possível falar com ele, é um `502`.
4. **Nada do anterior, e algo inesperado aconteceu no próprio código?** É um `500`.

O `500` vai por último de propósito. É o código usado quando nenhum outro descreve o que aconteceu e, por isso, é o mais fácil de usar em excesso: tudo o que dá errado pode ser chamado de «erro interno». Mas um `500` diz a quem opera «procure no código», e se a falha estava em uma dependência ou era uma manutenção planejada, manda a pessoa procurar onde não está. **Um `500` é uma confissão: «isto não foi previsto»**. Cada vez que o `revisor` responde `500` por algo que podia prever, está dizendo algo falso sobre si mesmo.

Há duas perguntas que a árvore não faz e que convém responder antes de seguir. A primeira: **e se foi o cliente que enviou algo impossível?** Então não é um `5xx`. Um corpo ilegível é `400`, um de mais de 16 KiB é `413`, um valor fora do intervalo é `422`, como se viu nas Lições 2 e 3. Um `5xx` para um erro do cliente é tão enganoso quanto um `200` para um erro: o cliente conclui que o problema não é dele e repete a mesma requisição, que vai falhar do mesmo jeito. A segunda: **e os `5xx` que o curso não usa?** O `501` foi mencionado na Lição 2: serve para um método que o servidor não implementa em nenhum recurso. O `505` é para uma versão de HTTP que o servidor não admite. Nenhum é um erro de capacidade nem de uma dependência, e o `revisor` não precisa deles.

### 4.3 `500`: o que ninguém esperava

#### 4.3.1 A pergunta que decide

A RFC 9110 define o `500 Internal Server Error` na [seção 15.6.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.1) em uma única frase: o servidor encontrou **uma condição inesperada** que o impediu de cumprir a requisição. A palavra que importa é «inesperada». A pergunta que decide o `500` é: **isto foi previsto?** Se a resposta é sim, existe outro código que o descreve melhor. Se é não, é um `500`, e o honesto é responder assim, em vez de disfarçá-lo de outra coisa.

Na prática, um `500` é quase sempre uma exceção que ninguém capturou: um `undefined` onde se esperava um objeto, uma divisão por zero, uma conexão com o banco de dados que se rompeu no meio de uma consulta. O que o servidor pode fazer bem com um `500` não é evitá-lo (se pudesse, não seria inesperado), mas **respondê-lo bem**: com o código correto, sem contar demais, e deixando em algum lugar a informação de que quem opera precisa para corrigi-lo.

#### 4.3.2 Provocá-lo

O `revisor` desta lição traz um `500` de propósito, para que possa ser provocado quando se quiser. A rota `GET /servicios/{id}/informe` resume as revisões de um serviço e tem um defeito que escapa a qualquer um:

```ts
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

Ela busca a última revisão do serviço e lê o resultado. Funciona sempre que o serviço tem ao menos uma revisão concluída. Se não tem nenhuma, `revisiones[revisiones.length - 1]` é `undefined`, e ler `.resultado` sobre `undefined` lança um `TypeError`. Os dois `as` do código dizem ao TypeScript «confie em mim, aqui sempre há uma revisão», e o TypeScript confia: o defeito passa no `tsc` em modo estrito sem uma única reclamação. É o tipo de erro que produz um `500` em uma API real: o caso em que ninguém pensou, escondido atrás de uma suposição. O comentário diz que o defeito fica assim até o final do curso, para que sempre haja um `500` a provocar.

Com o laboratório e o `revisor` recém-iniciados, o serviço 1 não tem revisões. Peça o relatório dele duas vezes:

```text
$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia affc3b8a-5ab9-42f5-8b37-2face1f8eafd

$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia bf0e3b0a-790f-4625-80e7-017b0bcfa403
```

Convém ler as duas respostas com a tabela do porquê à mão. O código é `500`: o servidor confessa que algo inesperado aconteceu, e o cliente sabe que o problema não é dele. O corpo não diz o que aconteceu, nem onde, nem em que arquivo. Diz apenas duas coisas: que foi um erro interno, e uma **referência**. E a referência é diferente em cada resposta: cada erro é um acontecimento distinto, ainda que a causa seja a mesma.

Agora observe o terminal do `revisor`:

```text
GET /servicios/1/informe
error affc3b8a-5ab9-42f5-8b37-2face1f8eafd en GET /servicios/1/informe: TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:304:28)
    at atender (file://<carpeta>/rutas.ts:104:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:23:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:35:44)
```

Aí está tudo o que o cliente não viu: a mensagem do erro (`TypeError: Cannot read properties of undefined (reading 'resultado')`) e os frames do stack trace, do mais recente ao mais antigo. O primeiro diz onde o erro nasceu: a função `informe`, em `servicios.ts`, linha 304, coluna 28, que é justamente o `.resultado` sobre `ultima`, a revisão que não existe. Os outros três dizem como se chegou ali: `atender`, em `rutas.ts`, chamou o handler, `atenderSinFiltrar`, em `servidor.ts`, chamou `atender`, e o servidor do Node chamou `atenderSinFiltrar`. E no início da linha, a mesma referência que o cliente recebeu. Se alguém relatar «recebi um erro com a referência `affc3b8a-…`», quem opera procura esse texto no log e encontra o stack trace exato **dessa** requisição, entre milhares.

#### 4.3.3 `servidor.ts`: a referência e o stack trace

Nas Lições 1 a 3, `servidor.ts` tinha uma rede de segurança mínima, `atenderSinCaerse`, que respondia `500 error interno` e escrevia a mensagem no terminal. Esta lição a converte na rede completa, `atenderSinFiltrar`:

```ts
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
      fallar(respuesta, 500, `error interno; referencia ${referencia}`);
    } else {
      respuesta.destroy();
    }
  }
}
```

Leia primeiro `atenderSinFiltrar`, que é a que captura. Tudo o que o `revisor` faz passa pelo `await atender(...)` dentro do `try`. Se algo lançar uma exceção, em qualquer handler, em qualquer profundidade, ela sobe até este `catch`. Ali acontecem três coisas, nesta ordem.

**Primeiro, sorteia-se uma referência** com `randomUUID()`, do módulo `node:crypto`, que segundo a documentação do Node gera um identificador UUID de versão 4 aleatório, com um gerador criptográfico. Que seja aleatório importa por dois motivos. Um: dois erros praticamente nunca compartilham referência (um UUID v4 traz 122 bits aleatórios: uma colisão é possível em teoria e desprezível na prática), de modo que a referência identifica uma requisição e não uma causa. O outro: não revela nada. Um número sequencial (`error 1043`) diria a quem o recebe quantos erros o servidor já teve, e em que ritmo; um UUID aleatório não diz nada além de «este acontecimento».

**Segundo, escreve-se o stack trace no terminal**, com a referência na frente. O terminal é o log de quem opera: em um servidor real, isso iria para um sistema de registros, e o princípio é o mesmo.

**Terceiro, responde-se ao cliente**, mas só se ainda for possível. `respuesta.headersSent` indica se a linha de status e os cabeçalhos já saíram. Se não saíram, responde-se `500` com a referência. Se já saíram (um handler que começou a responder `200` e lançou uma exceção no meio do corpo), já não é possível mudar o código: a linha de status é a primeira coisa que viaja, e não pode ser retirada. A única coisa honesta é cortar a conexão com `respuesta.destroy()`, para que o cliente veja um corpo incompleto e não um `200` que parece inteiro. Do lado do `curl`, aparece como um erro 18, «transferência incompleta»: chegaram o código e os cabeçalhos, mas não todo o corpo prometido. Foi medido com um servidor de brinquedo que escrevia `abc` e cortava: com `Content-Length: 100` o `curl` diz `(18) transfer closed with 97 bytes remaining to read`, e sem `Content-Length` (transferência em partes) diz `(18) transfer closed with outstanding read data remaining`; nos dois casos, erro 18.

Agora `pilaDelCurso`. `error.stack` é um texto: a mensagem na primeira linha e, depois, uma linha por frame, cada uma com `at`. A função fica com a mensagem e com os frames que não contêm `node:` nem `node_modules`. Os frames de `node:` são os do próprio Node (`node:events`, `node:_http_server`) e os de `node_modules` seriam os das dependências, se o curso tivesse alguma. Eles são removidos por dois motivos. O primeiro é prático: os números de linha dos frames internos do Node mudam a cada versão, de modo que uma saída que os incluísse mudaria a cada atualização do Node, ainda que o código não mudasse. O segundo é uma questão de ofício: esses frames não podem ser corrigidos por quem está aprendendo, nem quase nunca por quem opera. O que é necessário para consertar o `500` está nos frames do próprio código, e esses continuam ali. A seção «O erro a ser observado» mostra o stack trace completo, com os frames do Node incluídos, e por que essa versão é um problema quando viaja.

Observe o nome da função, `atenderSinFiltrar`. Lê-se como «atender o que ninguém filtrou antes»: é a rede de segurança para o que escapou de todos os handlers. Não quer dizer que não filtre o que sai: filtra tudo, e ao cliente só chega a referência. Se cada handler fizesse bem o trabalho dele, este `catch` nunca seria ativado. Por isso cada vez que é ativado é uma notícia para quem opera, e a referência é o fio para puxar.

#### 4.3.4 Quadro de segurança: o que jamais se diz em um erro

> **Quadro de segurança.** Um erro do servidor é uma superfície pública. Qualquer coisa que viaje no corpo pode ser lida por quem fez a requisição, guardada por um proxy, copiada por alguém em um canal de suporte e indexada por um buscador, se a resposta chegar a uma página. O que jamais se diz:
>
> - **Stack traces.** Revelam nomes de arquivos, de funções e de dependências, e a estrutura interna do programa.
> - **Caminhos da máquina.** `file:///home/despliegue/revisor/servicios.ts` informa o usuário que executa o processo, como o servidor está organizado e onde procurar.
> - **Consultas SQL e nomes de tabelas ou colunas.** Um erro de banco de dados que repete a consulta mostra a quem procura uma injeção exatamente o que o servidor está construindo com a entrada dele.
> - **Segredos.** Strings de conexão, tokens, senhas, chaves. Aparecem em erros mais do que parece: uma exceção que imprime o objeto de configuração completo, ou uma URL com credenciais dentro.
> - **Versões e nomes de produtos.** O servidor web, a linguagem, o framework e sua versão dizem a um atacante quais vulnerabilidades conhecidas testar.
> - **Nomes de máquinas e endereços internos.** O mesmo que o `revisor` já evita na rejeição de SSRF desde a Lição 1: a mensagem diz que um nome resolve para um endereço privado, mas não qual.
>
> O catálogo de fraquezas comuns da MITRE tem um nome para isso: [CWE-209](https://cwe.mitre.org/data/definitions/209.html), «geração de uma mensagem de erro que contém informação sensível», e inclui entre seus exemplos os stack traces expostos, os caminhos completos de arquivos e a estrutura das consultas. A [cheat sheet da OWASP sobre tratamento de erros](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html) resume isso na mesma regra que o `revisor` segue: o detalhe do erro é registrado **do lado do servidor**, para investigá-lo, e **não é devolvido** a quem pediu, que recebe uma mensagem genérica.
>
> **A referência é a ponte.** Sem ela, calar o stack trace tornaria o `500` inútil para todos: o cliente não saberia o que relatar, e quem opera não saberia o que procurar. Com ela, o cliente tem um identificador que não revela nada, e quem opera tem, no log, tudo o que o cliente não viu. É a forma de não contar nada sem deixar de ajudar.
>
> **Calar também o texto do erro.** O erro mais frequente não é enviar o stack trace completo, mas enviar somente `error.message`, que parece inofensivo. Não é. A mensagem de uma exceção é escrita por quem a lançou, que pode ser uma biblioteca fora do controle, e não se sabe o que ela vai conter: a de um driver de banco de dados pode trazer o trecho de SQL que falhou, e a de um erro de rede pode trazer o endereço interno ao qual não foi possível conectar. No `revisor` isso será visto na seção 4.4.2: quando um serviço responde lixo, o `fetch` diz `Response does not match the HTTP/1.1 protocol (Expected HTTP/, RTSP/ or ICE/)`, e esse texto é guardado em `motivo` e não viaja. O `502` diz, com palavras do `revisor`, «não deu uma resposta HTTP válida: cortou a conexão ou respondeu algo que não é HTTP». **O que sai para fora é escrito pelo programa, com palavras dele**; o texto de uma exceção nunca é reenviado.
>
> **O log também não é uma gaveta sem fundo.** O `revisor` registra o caminho solicitado com sua consulta (`peticion.url`, com tudo o que vem depois do `?`), e se uma API recebesse tokens na URL, ficariam escritos ali. A [cheat sheet da OWASP sobre logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) pede para não registrar tokens de acesso nem dados sensíveis: em uma API real, registra-se o caminho sem a consulta, ou com os valores sensíveis riscados.

### 4.4 `502` e `504`: quando o `revisor` faz o papel de gateway

#### 4.4.1 A pergunta que decide

Os dois códigos têm uma condição em comum, que a RFC 9110 escreve nas duas definições: o servidor responde assim **enquanto atua como gateway ou proxy** (*gateway or proxy*). Ou seja: para responder, precisou pedir algo a outro servidor, e esse outro falhou. A [seção 15.6.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.3) diz que o `502 Bad Gateway` significa que o servidor recebeu **uma resposta inválida** do servidor ao qual foi perguntar (a RFC o chama de *inbound server*: o que fica em direção à origem, do lado contrário ao cliente). A [seção 15.6.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.5) diz que o `504 Gateway Timeout` significa que **não recebeu uma resposta a tempo** do servidor do qual precisava de algo para completar a requisição.

As duas perguntas que decidem são, então:

1. **Para responder, precisei perguntar a outro?** Se não, não é nem `502` nem `504`. Um servidor que não depende de ninguém e falha por um erro imprevisto na própria lógica responde `500`. (Se a causa é que está sobrecarregado ou em manutenção de propósito, o código é `503`, que esta lição vê em 4.5; o `500` é para o que ninguém previu.)
2. **O que o outro respondeu?** Nada a tempo → `504`. Algo que não é uma resposta HTTP válida → `502`.

Há um caso que a RFC não nomeia: **não foi possível nem conectar** (ninguém escutava naquela porta). Não é uma resposta inválida, porque não houve resposta; tampouco é uma resposta tardia, porque a tentativa terminou na hora. O `revisor` o trata como um `502`: o que está atrás não respondeu nada válido, e o problema é de lá. É um princípio de design, não uma norma. O que não é opção é um `500`: o `revisor` previu, sim, que a conexão podia falhar, e o código dele não tem culpa.

Observe o que o `502` e o `504` **não** dizem: não dizem que o `revisor` esteja errado. Dizem ao cliente «o problema está atrás de mim», e dizem a quem opera o `revisor` que não procure no código dele. É a resposta à pergunta das 19h20 da cena do início.

#### 4.4.2 `cliente.consultar`: quatro desfechos mais um

A face cliente do `revisor` já consultava serviços desde a Lição 1, com `revisar`, que devolvia um resultado já classificado: `ARRIBA`, `LENTO` ou `CAIDO`. Para responder como gateway é preciso mais detalhe: não basta saber que algo deu errado, é preciso saber **o que** deu errado. Por isso `cliente.ts` ganha uma função, `consultar`, que devolve o desfecho em estado bruto:

```ts
// Lo que puede pasar al consultar: o hubo una respuesta HTTP, o no la hubo por una de tres razones.
export type Consulta =
  | { tipo: "respuesta"; codigo: number; ms: number; reintentarEn: number | null }
  | { tipo: "tiempo-agotado" }
  | { tipo: "sin-conexion" }
  | { tipo: "respuesta-invalida"; motivo: string }
  | { tipo: "destino-prohibido"; motivo: string };

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
```

`Consulta` é uma **união discriminada**: um tipo que pode ser de uma entre cinco formas, e o campo `tipo` diz qual. Só a primeira, `"respuesta"`, traz um código; as outras quatro são as formas de **não** ter um. Observe que o tipo torna impossível um erro muito comum: inventar um código para o que não foi uma resposta (um `0`, um `-1`, um `500` falso). Se não houve resposta, não há campo `codigo` a preencher. A Lição 0 pôs isso em «O que se costuma fazer de errado»: tratar «não foi possível conectar» como um código faz perder a informação mais útil, que é se o servidor respondeu ou não.

`consultar` decide assim:

- **Destino proibido.** Antes de cada conexão, o destino é verificado de novo contra a lista de SSRF da Lição 1, porque o DNS pode ter mudado desde o cadastro. Se não for permitido, nem se tenta.
- **Resposta.** Se o `fetch` devolveu uma resposta, houve HTTP, com o código que fosse. O corpo não é lido (`body?.cancel()`): para saber como está um serviço basta o código dele, e ler um corpo alheio é gastar memória em algo que não será usado. `redirect: "manual"` faz com que um `301` do serviço seja informado como `301` e não seja seguido: o `revisor` diz o que o serviço respondeu, não para onde o mandou.
- **Tempo esgotado.** `AbortSignal.timeout(limiteMs)` aborta a requisição se o limite do serviço for ultrapassado, e o `fetch` lança uma `DOMException` com nome `TimeoutError`. A documentação da MDN distingue esse nome do `AbortError`, que é o que aparece quando o cancelamento vem de outro lugar; por isso o código pergunta pelo nome exato.
- **Sem conexão.** Se a causa do erro traz o código `ECONNREFUSED` (ninguém escuta naquela porta), não havia com quem falar. `ENOTFOUND` (o nome deixou de existir) fica por completude, mas quase nunca chega aqui: `revisarDestino` já resolveu o nome um instante antes, e se não conseguiu, a consulta termina como destino proibido, com o motivo `el nombre … no se pudo resolver`.
- **Resposta inválida.** Todo o resto: conectou, e o que aconteceu depois não foi uma resposta HTTP. `/basura` cai aqui, com a causa `Response does not match the HTTP/1.1 protocol (Expected HTTP/, RTSP/ or ICE/)`, e `/cortar` também, com a causa `other side closed` («o outro lado fechou»). O texto é guardado em `motivo`, para quem quiser depurar a partir do código, e, como o quadro disse, não sai em nenhuma resposta.

Que «resposta inválida» seja o caso padrão é uma decisão: se aparecer uma falha que o código não conhece, ela é tratada como a mais geral das falhas de um serviço alheio, não como um erro do `revisor`. Se o `revisor` tratasse o desconhecido como erro próprio, um tipo de falha de rede que ninguém previu acabaria no `catch` de `servidor.ts` e sairia como `500`, mandando procurar no lugar errado.

E `revisar`, a função de antes, agora é uma tradução de `consultar` para o resultado que uma revisão guarda:

```ts
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

O `switch` cobre os cinco casos, e o TypeScript verifica que nenhum fique de fora: se amanhã alguém acrescentar um sexto tipo a `Consulta` e esquecer este `switch`, a função deixaria de devolver um `Resultado` em todos os caminhos, e o `tsc` apontaria. A classificação não mudou em relação à Lição 1, exceto em um detalhe: se o serviço respondeu um erro e trouxe `Retry-After`, o detalhe o anota, `503 (reintentar en 120 s)`. A seção 4.5.3 explica como esse valor é lido.

#### 4.4.3 A consulta de saúde

As revisões da Lição 1 são assíncronas: pede-se uma, recebe-se um `202`, e o resultado chega depois. Para praticar o `502` e o `504` é preciso o contrário, uma consulta **em tempo real**, em que o `revisor` pergunta ao serviço naquele momento e responde com o que aconteceu. É a rota `GET /servicios/{id}/salud`:

```ts
// GET /servicios/{id}/salud: el revisor consulta el servicio en este momento y hace de pasarela.
// Si hubo respuesta HTTP, la informa con 200, sea cual sea su código. Si no la hubo, la culpa es de
// lo que está detrás: 504 si no contestó a tiempo, 502 si no contestó algo que sea HTTP.
export async function salud({ respuesta, parametros, credencial }: Contexto): Promise<void> {
  // La consulta en vivo también sale a la red, igual que una revisión: sin límite, el revisor serviría
  // para golpear un servicio ajeno a través de él. Cuenta por credencial, antes de buscar el servicio,
  // en una ventana aparte de la de las revisiones.
  const decision = permitir(`salud:${credencial.nombre}`, CONSULTAS_POR_VENTANA, VENTANA_MS);
  if (!decision.permitido) {
    fallar(respuesta, 429, `ya pediste ${CONSULTAS_POR_VENTANA} consultas en vivo en el último minuto`, {
      "Retry-After": String(decision.esperaS),
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
      fallar(respuesta, 504, `el servicio ${servicio.id} no respondió en ${servicio.limiteMs} ms`);
      return;
    case "sin-conexion":
      fallar(respuesta, 502, `no se pudo conectar con el servicio ${servicio.id}`);
      return;
    case "destino-prohibido":
      fallar(respuesta, 422, `destino prohibido: ${consulta.motivo}`);
      return;
    case "respuesta-invalida":
      fallar(respuesta, 502, `el servicio ${servicio.id} no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP`);
      return;
  }
}
```

A primeira coisa é um limite: cada credencial pode pedir **3 consultas em tempo real por minuto**, porque cada uma faz o `revisor` sair para a rede. A seção 4.6 o explica junto com o limite das revisões; aqui basta saber que ele existe, porque decide como se distribuem os testes. Depois busca-se o serviço com `encontrar`, a mesma função que todas as rotas com `{id}` usam: um serviço de outra equipe responde `404`, igual a um que não existe, como na Lição 2. Depois consulta-se, e cada desfecho tem seu código. Teste-a com os cinco serviços da equipe a. São cinco consultas e cada credencial tem três por minuto, então as três primeiras vão com `lectura-a` e as duas últimas com `escritura-a`:

```text
$ curl -i http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 35
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":1,"codigo":200,"ms":8}

$ curl -i http://127.0.0.1:18080/servicios/2/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 35
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":2,"codigo":503,"ms":1}

$ curl -i http://127.0.0.1:18080/servicios/4/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 38
Date: Wed, 21 Oct 2026 13:19:08 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":4,"codigo":200,"ms":1503}

$ curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 504 Gateway Timeout
Content-Type: text/plain; charset=utf-8
Content-Length: 39
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 5 no respondió en 1000 ms
tardó 1.004405 s

$ curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/6/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 502 Bad Gateway
Content-Type: text/plain; charset=utf-8
Content-Length: 102
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 6 no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP
tardó 0.002184 s
```

Um por um:

- **O 1 (`catalogo`) responde `200`** com `"codigo":200`. O serviço está bem, e o `revisor` também.
- **O 2 (`pagos`) responde `200`** com `"codigo":503`. Esta é a linha que mais confunde, e a mais importante da seção. O serviço de pagamentos está fora do ar, sim, mas **respondeu**: disse `503`, com HTTP válido. O `revisor` fez o que lhe foi pedido, que era descobrir como está o serviço, e descobriu. A resposta dele é um sucesso que traz uma má notícia dentro. Se o `revisor` respondesse `503` aqui, estaria dizendo ao cliente «eu, o `revisor`, não posso atender», e qualquer máquina do caminho (um balanceador, um monitor, um cache) acreditaria: o monitor marcaria o `revisor` como fora do ar por culpa de um serviço alheio.
- **O 4 (`inventario`) responde `200`** com `"ms":1503`: demorou, mas menos que o limite de 2000 ms. Esse tempo é real: o laboratório esperou 1500 ms e o resto é o que a conexão levou.
- **O 5 (`reportes`) responde `504`**, e o `curl` mediu **1,004 segundo**: o limite do serviço é 1000 ms, e o `revisor` parou de esperar exatamente ali. O laboratório ia responder aos 3000 ms, mas o `revisor` já não estava escutando. O corpo diz quanto esperou, que é o que serve ao cliente para entender o que aconteceu.
- **O 6 (`facturacion`) responde `502`**, e levou **2 milissegundos**: o laboratório respondeu lixo de imediato, e o `revisor` o reconheceu como tal.

Falta o quinto desfecho, destino proibido, que responde `422`. É a mesma regra de SSRF da Lição 1, aplicada outra vez imediatamente antes de conectar: se o nome de um serviço cadastrado corretamente agora resolve para um endereço privado, ou já não resolve, o `revisor` não se conecta. Não há execução aqui porque não é possível provocá-lo a partir do laboratório: qualquer URL que caia nessa regra já foi rejeitada com `422` no cadastro. Por que `422` e não `502`? Porque o `revisor` não chegou a falar com o que está atrás: não é uma falha de outro servidor, mas um dado guardado (a URL do serviço) que hoje não pode ser cumprido. É um princípio de design, e tem um custo que convém dizer: quem pediu a saúde não enviou nada errado, e o `422` fala de um dado cadastrado por outra pessoa, talvez meses atrás. O `detail` diz o motivo, para que se saiba o que corrigir no serviço.

Observe os dois tempos. O `504` demorou o que diz o limite; o `502`, quase nada. Não é coincidência: um `504`, em um gateway simples como este, custa o tempo que se esperou antes de desistir, e um `502` pode ser instantâneo. (Um gateway com circuit breaker ou com um prazo já vencido pode dar um `504` quase instantâneo; o que define o `504` é que o prazo para a resposta do outro se esgotou, não quanto o gateway demorou para dizê-lo.) Essa diferença importa a quem projeta um cliente: um cliente que espera 30 segundos por um gateway com limite de 1 segundo está desperdiçando 29.

Falta o caso de `/cortar`. Não há serviço de inicialização que o use, então cadastre um e peça a saúde dele, outra vez com `escritura-a`, que leva duas consultas:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"colgado","url":"http://127.0.0.1:18081/cortar"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-6db25d01"
Content-Type: application/json
Content-Length: 83
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"colgado","url":"http://127.0.0.1:18081/cortar","limite_ms":2000}

$ curl -i http://127.0.0.1:18080/servicios/7/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 502 Bad Gateway
Content-Type: text/plain; charset=utf-8
Content-Length: 102
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 7 no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP
```

`502`, com o mesmo corpo do serviço 6. Do ponto de vista do `revisor`, um serviço que aceita a conexão e a fecha sem dizer nada não deu uma resposta válida: não houve linha de status. `consultar` não distingue os dois casos (ambos são `respuesta-invalida`), e por isso o corpo diz as duas coisas que podem ter acontecido, «cortou a conexão ou respondeu algo que não é HTTP», em vez de afirmar uma que pode ser falsa. Separá-los exigiria olhar a causa do erro, e não mudaria o código, que é o que as máquinas leem.

#### 4.4.4 `500` versus `502` versus `504`

Os três são erros do servidor, e os três se confundem. Esta tabela reúne o que os separa:

| | `500` | `502` | `504` |
|---|---|---|---|
| Havia outro servidor atrás? | não é preciso | sim | sim |
| O que aconteceu? | algo inesperado no código | o de trás respondeu algo inválido, ou não foi possível conectar | o de trás não respondeu a tempo |
| Onde procura quem opera? | no código do servidor | no serviço de trás, ou na conexão | no serviço de trás: está lento ou fora do ar |
| Quanto demora a resposta? | o que levar para falhar | quase sempre pouco | pelo menos o limite do gateway |
| No `revisor` | `GET /servicios/1/informe` | `GET /servicios/6/salud` | `GET /servicios/5/salud` |

A regra curta: **`500` é «eu errei»; `502` e `504` são «errou o que está atrás de mim»**, e entre os dois, a diferença é se respondeu errado ou não respondeu a tempo.

Uma consequência dessa regra, que a seção «O erro a ser observado» mostra com uma execução: se o `revisor` deixasse o erro do `fetch` chegar até `servidor.ts`, o `502` e o `504` se converteriam em `500`, com referência e tudo. A resposta seria muito bem-educada (sem stack trace, com referência) e estaria errada: diria «eu errei» quando quem errou foi outro.

### 4.5 `503` e `Retry-After`: fechado para manutenção

#### 4.5.1 A pergunta que decide

A RFC 9110 define o `503 Service Unavailable` na [seção 15.6.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.4): o servidor **não pode atender a requisição neste momento** por uma sobrecarga temporária ou por uma manutenção programada, e isso **provavelmente se resolverá depois de um tempo**. O servidor **pode** enviar `Retry-After` para sugerir quanto esperar. E acrescenta uma nota que vale a pena conhecer: a existência do `503` não obriga um servidor saturado a usá-lo; alguns simplesmente recusam a conexão.

A pergunta que decide é: **o servidor decidiu, ou sabe, que agora não pode atender, e que isso é temporário?** As duas condições importam. «Decidiu ou sabe»: um `503` não é um erro que escapou, é uma resposta que o servidor escolheu dar. «Temporário»: o `503` promete ao cliente que, se esperar, a situação muda. Um servidor que responde `503` para sempre está dizendo algo falso.

A diferença em relação ao `500` vem daí. Os dois são do servidor e os dois dizem ao cliente que o problema não é dele. Mas o `500` diz «algo deu errado e não sei quando será corrigido», e o `503` diz «não posso agora, volte depois», muitas vezes com a hora exata. Para um cliente, a diferença é decidir entre relatar um erro e esperar. Para um cache, também: na Lição 0 viu-se que `stale-if-error` permite a um cache servir a cópia anterior diante de um `500`, `502`, `503` ou `504`, mas um monitor que conta erros deveria contar uma manutenção anunciada de modo distinto de uma falha. Se a manutenção é respondida com `500`, ninguém consegue distingui-las.

#### 4.5.2 O modo de manutenção

O `revisor` ganha um interruptor: `PUT /mantenimiento`, com `{"activo": true}` ou `{"activo": false}`, que só a credencial `admin` pode usar. Enquanto está ativado, todo o resto responde `503` com `Retry-After: 120`. Vive em um arquivo novo, `operacion.ts`:

```ts
let enMantenimiento = false;
const VUELVE_EN_S = 120;

// Si está en mantenimiento, responde 503 y devuelve true. /mantenimiento siempre se atiende.
export function atajarPorMantenimiento(ruta: string, respuesta: ServerResponse): boolean {
  if (!enMantenimiento || ruta === "/mantenimiento") return false;
  fallar(respuesta, 503, "el revisor está en mantenimiento", { "Retry-After": String(VUELVE_EN_S) });
  return true;
}

// PUT /mantenimiento con {"activo": true} o {"activo": false}. Solo la credencial admin.
export async function cambiarMantenimiento({ peticion, respuesta, credencial }: Contexto): Promise<void> {
  if (credencial.rol !== "admin") {
    fallar(respuesta, 403, "solo quien opera el revisor puede cambiar el mantenimiento");
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

Duas funções. `atajarPorMantenimiento` é chamada a partir do ponto de entrada, antes de tudo, e responde `503` se o modo estiver ativado; devolve `true` para que o ponto de entrada saiba que já se respondeu. `cambiarMantenimiento` é o handler de `PUT /mantenimiento`: verifica o papel, lê o corpo com o mesmo `leerJson` de sempre (assim um corpo que não é JSON recebe o `415` ou o `400` correspondente, como na Lição 2), exige um booleano (se não, `422`, com a mesma `rechazarDatos` da Lição 3) e muda o modo.

Em `rutas.ts`, a parada é acrescentada no ponto de entrada, junto às outras paradas que vão antes das sete perguntas:

```ts
  if (redirigir(url.pathname, url.search, respuesta)) return;
  if (atajarPorMantenimiento(url.pathname, respuesta)) return;
  if (versionRetirada(url.pathname, respuesta)) return;
```

Teste com as duas credenciais e, depois, peça duas coisas enquanto o modo durar:

```text
$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"activo":true}'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 59
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

solo quien opera el revisor puede cambiar el mantenimiento

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":true}'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a'
HTTP/1.1 503 Service Unavailable
Retry-After: 120
Content-Type: text/plain; charset=utf-8
Content-Length: 34
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el revisor está en mantenimiento

$ curl -i http://127.0.0.1:18080/no-existe
HTTP/1.1 503 Service Unavailable
Retry-After: 120
Content-Type: text/plain; charset=utf-8
Content-Length: 34
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el revisor está en mantenimiento

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":false}'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a'
200
```

Seis respostas, e cada uma diz algo:

- **`escritura-a` recebe `403`.** É um escritor, e a rota é de escrita, então passou na pergunta 4 do ponto de entrada; mas o handler verifica além disso que seja `admin`. Ativar a manutenção muda o dia de todas as equipes, e não cabe a uma só.
- **`admin` recebe `204`.** O modo foi ativado; não há nada a devolver. O terminal do `revisor` o registra: `operación: mantenimiento encendido`.
- **`GET /servicios` recebe `503` com `Retry-After: 120`.** O corpo diz o que está acontecendo; o cabeçalho diz quanto esperar; o código diz que não é culpa do cliente e que é temporário.
- **`/no-existe`, sem credencial, também recebe `503`.** Esta merece uma pausa. É uma rota que não existe, pedida por alguém que não disse quem é, e a resposta não é `404` nem `401`. É que a manutenção vem **antes** das sete perguntas. A razão é a mesma da Lição 2 para os redirecionamentos: enquanto o `revisor` está em manutenção, nenhuma resposta que dependa dos dados dele é confiável, e responder `404` a uma rota que existe porque «hoje não estou atendendo» seria mentir. Uma única resposta para tudo é o mais honesto, e além disso não ensina nada a ninguém: um desconhecido não descobre quais rotas existem.
- **O `admin` desativa o modo com outro `204`.** `/mantenimiento` é a única rota atendida durante a manutenção, porque, se não fosse, ninguém poderia desativá-lo. Observe que a exceção está escrita na própria `atajarPorMantenimiento` e não no ponto de entrada: o interruptor e sua exceção vivem juntos.
- **`GET /servicios` volta a `200`.**

Por que a manutenção vem **depois** dos redirecionamentos? Porque um redirecionamento não entrega dados: diz onde está a rota nova, e isso continua sendo verdade durante a manutenção. Um cliente que pede `/viejo/servicios` recebe o `301`, vai a `/servicios` e ali recebe o `503`. Cada resposta diz algo verdadeiro.

#### 4.5.3 `Retry-After`, nas duas formas

`Retry-After` está definido na [seção 10.2.3 da RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3). Diz quanto o cliente **deveria** esperar antes de pedir de novo; com um `503`, quanto se espera que dure a indisponibilidade. O valor tem duas formas, e a gramática da RFC as escreve assim:

```text
Retry-After = HTTP-date / delay-seconds
delay-seconds  = 1*DIGIT
```

Ou uma data HTTP (`Fri, 31 Dec 1999 23:59:59 GMT`, o exemplo da RFC), ou uma quantidade de segundos (`120`). `1*DIGIT` significa «um ou mais dígitos»: um inteiro sem sinal, sem ponto decimal, sem espaços no meio. `1.5` não é um valor válido, nem `-1`, nem `2m`.

A data, por sua vez, tem três formatos, por razões históricas: a [seção 5.6.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7) define o preferido (`Sun, 06 Nov 1994 08:49:37 GMT`) e dois obsoletos que vêm de versões antigas do HTTP (`Sunday, 06-Nov-94 08:49:37 GMT` e `Sun Nov  6 08:49:37 1994`, o formato da função `asctime` do C), e diz que quem lê uma data em um campo HTTP **deve** aceitar os três. Quem gera uma data HTTP **deve** usar somente o primeiro.

Quando convém cada forma? Os segundos são relativos: «espere 120 segundos a partir do momento em que isto foi recebido». A data é absoluta: «volte a partir das 23h59». Os segundos são mais robustos, porque não dependem de o relógio do cliente e o do servidor estarem de acordo. A data faz sentido quando o servidor conhece um horário concreto, por exemplo o fim de uma janela de manutenção anunciada. O `revisor` envia segundos em todos os casos.

Do lado do cliente, `cliente.ts` lê as duas formas com `segundosDeEspera` e seu auxiliar, `fechaHttp`:

```ts
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
```

Se o cabeçalho não vem, `segundosDeEspera` devolve `null`: não há instrução. Se são apenas dígitos, são os segundos. Se não, pede a `fechaHttp` que o leia como data e calcula quantos segundos faltam, arredondando para cima; uma data que já passou dá `0`, «pode tentar já». Se não é uma data, devolve `null`: um valor que não se entende não é uma instrução, e quem chama usa sua própria espera padrão.

`fechaHttp` é longa porque faz o que a RFC pede e nada mais. Tem uma expressão regular para cada um dos três formatos, com os nomes de dias e meses que a RFC enumera; monta a data com `Date.UTC`, porque uma data HTTP sempre está em GMT, embora a forma `asctime` não o escreva; aplica a regra da RFC 850 para o ano de dois dígitos (se ficar mais de 50 anos no futuro, é do século anterior); e no final verifica se a data montada é a que foi pedida, porque `Date.UTC` aceita 32 de outubro e o converte, sem reclamar, em 1º de novembro. O que ela **não** faz é o mais tentador: passar o texto para `Date.parse`. O comentário diz por quê, e o exercício 2 mostra isso com uma execução: `Date.parse` entende como data quase qualquer coisa, e lê a forma `asctime` no horário local da máquina.

Este programa testa `segundosDeEspera` com cinco valores e com o cabeçalho ausente:

```ts
// fig04_03.ts — leer Retry-After en sus dos formas: segundos o una fecha HTTP.
import { segundosDeEspera } from "./fig04_01/cliente.ts";

const dentroDe90 = new Date(Date.now() + 90_000).toUTCString();
const VALORES: (string | null)[] = ["120", "0", dentroDe90, "Wed, 21 Oct 2015 07:28:00 GMT", "mañana", null];

for (const valor of VALORES) {
  const texto = valor === null ? "(sin la cabecera)" : JSON.stringify(valor);
  console.log(`${texto.padEnd(34)} → ${segundosDeEspera(valor) ?? "null: no dice cuánto esperar"}`);
}
```

```text
$ node fig04_03.ts
"120"                              → 120
"0"                                → 0
"Wed, 21 Oct 2026 13:21:26 GMT"    → 90
"Wed, 21 Oct 2015 07:28:00 GMT"    → 0
"mañana"                           → null: no dice cuánto esperar
(sin la cabecera)                  → null: no dice cuánto esperar
```

Os segundos são lidos tal como estão; a data de dali a 90 segundos dá `90`; a de 2015 já passou e dá `0`; e `mañana` e a ausência dão `null`. O exercício 2 a coloca diante de uma versão ingênua, com valores que não são válidos.

O valor lido termina no detalhe da revisão. Será visto em 4.6.3: uma revisão do serviço 2, que responde `503` com `Retry-After: 120` a partir do laboratório, fica com `"detalle":"503 (reintentar en 120 s)"`. O `revisor` ainda não faz nada com esse número, além de anotá-lo; a Lição 6 decide quando vale a pena esperar e tentar de novo, e quando não.

#### 4.5.4 `503` versus `500`

Uma forma rápida de não os confundir é perguntar **quem sabia**. Um `503` é respondido por um servidor que sabe que não pode atender: foi colocado em manutenção, ou ele mesmo mediu que está saturado (conexões abertas demais, uma fila cheia). Um `500` é respondido por um servidor que ficou sabendo do próprio erro ao mesmo tempo que o cliente. Se sabia, e é temporário, é `503`; se não sabia, é `500`.

Há um caso limite que vale a pena pensar: um banco de dados que não responde. Para o servidor da API, é um `500` ou um `503`? Se o código tenta se conectar, falha, e a exceção sobe até a rede de segurança de `servidor.ts`, sai um `500`, e não está errado: ninguém previu a falha. Se o código detecta que o banco não está disponível e o diz de propósito, um `503` com `Retry-After` é mais útil, porque diz ao cliente que é temporário. E há quem responda `502` ou `504`, com o argumento de que o banco de dados é um servidor que está atrás. A RFC não resolve este caso: é um princípio de design, e o que importa é decidi-lo, escrevê-lo e aplicá-lo igual em todas as rotas. O `revisor` reserva o `502` e o `504` para a consulta de saúde, em que faz o papel de gateway de forma explícita, porque o trabalho dele é responder como está outro serviço.

### 4.6 `429`: requisições demais

#### 4.6.1 A pergunta que decide

O `429 Too Many Requests` não está na RFC 9110. Foi definido em 2012 pela [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html#section-4), na seção 4, junto com o `428` da Lição 3. A definição é curta: o usuário enviou **requisições demais em um tempo dado** («*rate limiting*», limitação de taxa). A resposta **deveria** explicar a situação e **pode** trazer `Retry-After`. O exemplo da RFC é um site que permite 50 requisições por hora a cada usuário identificado e responde com `Retry-After: 3600`.

A mesma seção diz duas coisas que vale a pena sublinhar. A primeira: a RFC **não define** como o servidor identifica o usuário nem como conta as requisições. Pode contar por recurso, por servidor inteiro ou entre vários servidores, e pode identificar o usuário por sua credencial ou por um cookie. Ou seja: quanto, a cada quanto tempo e por quem são decisões de quem projeta a API, e por isso precisam estar documentadas. A segunda: uma resposta `429` **não deve** ser guardada em um cache. Faz sentido: «já foram feitas requisições demais» é verdade para aquele cliente e naquele momento, não para o próximo cliente nem para dali a um minuto.

A pergunta que decide é: **o cliente pediu mais do que lhe cabe em um tempo dado?** Se a resposta é sim, o problema se resolve com tempo e com um cliente que reduz o ritmo; por isso é `4xx`. Se o servidor está saturado pela soma de todos os clientes, e não por um em particular, não é um `429` mas um `503`: nenhum cliente fez nada de errado.

A RFC 6585 tem, além disso, uma advertência em suas considerações de segurança ([seção 7.2](https://www.rfc-editor.org/rfc/rfc6585.html#section-7.2)): quando um servidor está sob ataque, responder `429` a cada requisição também gasta recursos, então o servidor **não é obrigado** a usar o `429`; às vezes é melhor cortar a conexão. O `429` serve tanto para o cliente que passa do limite quanto para frear quem abusa; mas sob um ataque de volume, responder a cada requisição também custa, e a RFC deixa o servidor cortar a conexão em vez de responder.

#### 4.6.2 A janela fixa

O limite do `revisor` vive em um arquivo novo, `limitador.ts`. É o algoritmo mais simples que existe, a **janela fixa**: conta quantas vezes uma chave foi usada desde que a janela começou, e quando a janela termina, outra começa do zero:

```ts
// fig04_01/limitador.ts — cuántas veces se puede hacer algo en una ventana de tiempo.
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

Cada chave tem sua janela: quando começou e quantos usos acumula. `permitir(clave, maximo, ventanaMs)` faz três perguntas. Não há janela, ou ela já terminou? Começa uma nova, com um uso, e permite-se. Há janela e restam usos? Conta-se mais um e permite-se. Acabaram? Rejeita-se, e diz-se quantos segundos faltam para a janela terminar, arredondando para cima. Esse número é o que viaja em `Retry-After`: o `revisor` não inventa uma espera, ele a calcula. Arredondar para cima importa: se faltam 0,3 segundo, dizer `0` convidaria o cliente a tentar de imediato, e voltaria a receber `429`.

`limitador.ts` não sabe nada de HTTP: não recebe requisições nem responde nada. Recebe uma chave e devolve uma decisão. Assim pode ser usado a partir de qualquer handler, e pode ser testado isoladamente, como será visto em 4.6.4.

#### 4.6.3 No `revisor`: três por minuto, por credencial

O que se limita? No `revisor`, o que mais custa é o que o faz sair para a rede: pedir uma revisão e pedir a saúde em tempo real (4.4.3). Sem limite, qualquer um com uma credencial pode colocá-lo para fazer milhares de conexões por minuto contra um serviço, o próprio ou o de outro, que é justamente o que acontecia na cena do início. O limite é de **3 revisões por credencial a cada 60 segundos**, em `pedirRevision`, e de outras 3 consultas em tempo real por credencial, em uma janela separada, em `salud`:

```ts
export function pedirRevision({ respuesta, parametros, credencial }: Contexto): void {
  // El límite cuenta por credencial y se consulta ANTES de buscar el servicio: así también cuentan los
  // 404 de quien prueba ids uno tras otro (enumeración), y lo que gasta una credencial no lo paga otra.
  const decision = permitir(`revisiones:${credencial.nombre}`, REVISIONES_POR_VENTANA, VENTANA_MS);
  if (!decision.permitido) {
    fallar(respuesta, 429, `ya pediste ${REVISIONES_POR_VENTANA} revisiones en el último minuto`, {
      "Retry-After": String(decision.esperaS),
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
```

Duas decisões, e as duas importam mais do que parece.

**A chave é a credencial**: `revisiones:` mais o nome da credencial. Assim, o que uma credencial gasta, outra não paga. Se a chave fosse o serviço, uma única credencial poderia gastar as três revisões de um serviço e deixar todos os demais um minuto sem poder revisá-lo: o `429` chegaria a quem não fez nada, que é justamente o que o código não deve dizer. A RFC 6585 permite contar por recurso, por servidor ou por usuário; o `revisor` conta por quem pede, porque o `429` diz a **esse** cliente que reduza **o ritmo dele**.

**O limite é consultado antes de `encontrar`.** Assim também contam as requisições que terminam em `404`. Parece um detalhe, e é a diferença entre um limite que freia quem testa identificadores um após o outro e um que não o vê: se o limite viesse depois, cada `404` sairia antes de tocar o limitador, e quem enumera nunca gastaria nenhuma janela. Há outro benefício: a chave sai de algo que o ponto de entrada já verificou (a credencial), não de um identificador que o cliente escreve, de modo que ninguém consegue criar chaves sem fim no `Map` de `limitador.ts` inventando ids.

Teste: três revisões do serviço 2 com `escritura-a`, uma quarta, e uma do serviço 4 com `admin`. Depois, uma quarta consulta em tempo real com `lectura-a`, que já fez três em 4.4.3, e o enumerador da Lição 2 com `escritura-b`, pedindo revisões dos ids 1 a 10. Por fim, aguarde 20 segundos e tente de novo a de `escritura-a`:

```text
$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: text/plain; charset=utf-8
Content-Length: 45
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 revisiones en el último minuto

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/4/revisiones -H 'Authorization: Bearer admin'
202

$ curl -i http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 429 Too Many Requests
Retry-After: 58
Content-Type: text/plain; charset=utf-8
Content-Length: 52
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 consultas en vivo en el último minuto

$ for id in 1 2 3 4 5 6 7 8 9 10; do curl -sS -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:18080/servicios/$id/revisiones -H 'Authorization: Bearer escritura-b'; done; echo
404 404 202 429 429 429 429 429 429 429 

$ sleep 20
$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
HTTP/1.1 429 Too Many Requests
Retry-After: 40
Content-Type: text/plain; charset=utf-8
Content-Length: 45
Date: Wed, 21 Oct 2026 13:19:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 revisiones en el último minuto
```

Linha por linha:

- **As três primeiras, `202`**, como na Lição 1. **A quarta, `429`**, com `Retry-After: 60`: a janela de `escritura-a` começou há um instante e restam 60 segundos. O corpo diz o que aconteceu com palavras do `revisor`, e o código e o cabeçalho dizem o que fazer.
- **A de `admin`, `202`**: tem sua própria janela. O que `escritura-a` gastou, outra credencial não paga.
- **A quarta consulta em tempo real de `lectura-a`, `429`**, com `Retry-After: 58`: a janela de consultas dela começou com a primeira requisição de 4.4.3, uns dois segundos antes. É outra janela, separada da das revisões: pedir a saúde não gasta revisões, nem o contrário.
- **O enumerador, `404 404 202 429 429 429 429 429 429 429`.** `escritura-b` é da equipe b: para ele, o 1 e o 2 não existem (`404`), e o 3 é dele (`202`). Essas três requisições encheram a janela, ainda que duas fossem `404`, e do 4 ao 10 recebe `429`. Nesse ritmo, percorrer cem mil identificadores levaria mais de três semanas.
- **Vinte segundos depois, outra vez `429`**, mas agora com `Retry-After: 40`. O número não é fixo: diz quanto falta de verdade. Um cliente que obedeça a esse cabeçalho não faz nem uma requisição a mais.

As três revisões aceitas de `escritura-a` e a de `admin` já terminaram. Observe a primeira de cada uma, e o relatório do serviço 2, que agora sim tem revisões:

```text
$ curl http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer lectura-a'
{"id":1,"servicio":2,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":503,"ms":1,"detalle":"503 (reintentar en 120 s)"}}

$ curl http://127.0.0.1:18080/revisiones/4 -H 'Authorization: Bearer lectura-a'
{"id":4,"servicio":4,"estado":"terminada","resultado":{"estado":"LENTO","codigo":200,"ms":1501,"detalle":"200"}}

$ curl -i http://127.0.0.1:18080/servicios/2/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 54
Date: Wed, 21 Oct 2026 13:19:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":2,"revisiones":3,"ultimo_estado":"CAIDO"}
```

A revisão de `pagos` ficou `CAIDO`, com `"detalle":"503 (reintentar en 120 s)"`: o laboratório respondeu `503` com `Retry-After: 120`, e `segundosDeEspera` o leu. A de `inventario`, `LENTO`, com 1501 ms contra um limite de 2000: levou metade do limite ou mais. E o relatório do serviço 2 responde `200`: o defeito de `informe` só morde quando não há revisões concluídas, e aqui há três.

#### 4.6.4 A janela fixa, vista de perto

A janela fixa é fácil de ler, e tem um defeito que convém ver com os próprios olhos. Este programa usa o mesmo `limitador.ts` do `revisor`, com um limite de 3 a cada 1000 ms para não esperar um minuto, e faz sete requisições em momentos escolhidos:

```ts
// fig04_02.ts — la ventana fija, vista de cerca: 3 permisos cada 1000 ms.
// Usa el mismo limitador del revisor, con una ventana corta para no esperar un minuto.
import { setTimeout as esperar } from "node:timers/promises";
import { permitir } from "./fig04_01/limitador.ts";

const MAXIMO = 3;
const VENTANA_MS = 1000;
// Cuándo pide cada petición, en milisegundos desde el arranque.
const PLAN = [0, 950, 960, 1005, 1010, 1015, 1020];

const inicio = performance.now();
const permitidas: number[] = [];
for (const cuando of PLAN) {
  await esperar(Math.max(0, cuando - (performance.now() - inicio)));
  const decision = permitir("demo", MAXIMO, VENTANA_MS);
  const ms = Math.round(performance.now() - inicio);
  if (decision.permitido) permitidas.push(ms);
  const texto = decision.permitido ? "permitida" : `rechazada: Retry-After ${decision.esperaS}`;
  console.log(`${String(ms).padStart(5)} ms  ${texto}`);
}
const rafaga = permitidas.filter((ms) => ms >= 900);
console.log();
console.log(`límite: ${MAXIMO} cada ${VENTANA_MS} ms`);
console.log(`permitidas entre ${rafaga[0]} y ${rafaga[rafaga.length - 1]} ms: ${rafaga.length}`);
```

```text
$ node fig04_02.ts
    2 ms  permitida
  950 ms  permitida
  961 ms  permitida
 1005 ms  permitida
 1011 ms  permitida
 1016 ms  permitida
 1021 ms  rechazada: Retry-After 1

límite: 3 cada 1000 ms
permitidas entre 950 y 1016 ms: 5
```

O limite diz «3 por segundo», e entre o milissegundo 950 e o 1016 passaram **5**. A primeira requisição abriu a janela nos primeiros milissegundos; as de 950 e 961 a encheram; no milissegundo 1000 a janela terminou e começou outra, que aceitou mais três. A sétima, aos 1021, foi rejeitada com `Retry-After: 1`. Na fronteira entre duas janelas, a janela fixa deixa passar até o dobro do limite em muito pouco tempo. Os milissegundos exatos mudam a cada execução (os temporizadores do Node não são exatos ao milissegundo), mas o cinco não.

É grave? Depende do que se protege. Para o `revisor`, que quer evitar milhares de consultas por minuto, que um serviço receba seis em vez de três na virada do minuto não importa. Para um limite que protege algo frágil, pode importar sim, e por isso existem outros algoritmos: a **janela deslizante**, que conta as requisições dos últimos 60 segundos contados a partir de agora, e o **token bucket**, que repõe permissões aos poucos e permite um burst pequeno, mas nunca o dobro. Os dois distribuem melhor e ensinam o mesmo que a janela fixa: há um máximo, há um tempo e, quando ele acaba, `429` com quanto esperar. O comentário de `limitador.ts` diz isso em uma linha.

#### 4.6.5 Quadro de segurança: o `429` como defesa

> **Quadro de segurança.** Um limite de requisições não protege apenas a capacidade. Também é uma defesa, porque muitos ataques precisam de muitas requisições:
>
> - **A enumeração.** Na Lição 2 apareceu o enumerador que testa `/servicios/1`, `/servicios/2`, `/servicios/3`… O ponto de entrada do `revisor` já responde igual ao que é alheio e ao que não existe, então não há nada a aprender com as respostas. O limite acrescenta outra camada, caso um dia escape uma diferença: como conta por credencial e antes de buscar o serviço, os `404` também contam, e em 4.6.3 viu-se o enumerador freado na quarta requisição. O que faz funcionar é **contar por quem pergunta**; um limite por recurso nunca o veria, porque quem enumera pede um recurso diferente a cada vez. O exercício 3 mostra isso com as duas versões.
> - **O esgotamento de recursos.** A OWASP o coloca em sua lista dos dez riscos mais importantes das APIs como [API4:2023, *Unrestricted Resource Consumption*](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption), e recomenda limitar quantas vezes um cliente pode interagir com a API em um tempo dado, com limites mais estritos nas operações caras, e fixar limites de tempo de execução. O `revisor` faz as duas coisas: limita o que sai para a rede (as revisões e a consulta em tempo real), e cada consulta tem seu limite de tempo (`limite_ms`, de 100 a 10 000), que é o que produz o `504`.
> - **O `revisor` como arma contra outros.** É a outra face do SSRF da Lição 1. A lista de destinos decide **para onde** o `revisor` se conecta; o limite decide **quantas vezes**. Sem ele, qualquer pessoa com uma credencial poderia usar o `revisor` para bombardear um serviço alheio, e o serviço veria as conexões vindo do `revisor`, não de quem as pediu.
>
> **O que este limite não resolve: a força bruta sobre as credenciais.** Adivinhar uma credencial testando milhões de valores é um ataque de muitas requisições, mas o `revisor` não o freia com seu limitador, e é de propósito. Um limite por credencial não serve contra quem ainda não tem uma, e um por endereço de origem, neste curso, frearia também as matrizes e os programas das lições, que rodam todos a partir de `127.0.0.1`. A força bruta é contida em outra camada: o provedor de identidade ou o gateway que fica na frente da API, com credenciais longas e aleatórias que não se podem adivinhar. A [cheat sheet da OWASP sobre autenticação](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) descreve essa camada: um máximo de tentativas fracassadas, contado **por conta** e não só por endereço, porque quem ataca pode trocar de endereço. As quatro credenciais do `revisor` são palavras de prática, escritas no código para que o curso possa ser acompanhado; em uma API real vêm de um provedor de identidade, como disse a Lição 2.
>
> **A chave do limite decide quem se protege.** Por credencial, como o `revisor`, distribui a capacidade entre os clientes e não pune um pelo que outro fez. Por recurso, protege o recurso, mas qualquer um pode gastar a janela de todos. Por endereço de origem, freia quem não tem credencial, mas pune todos os que compartilham uma mesma saída para a internet. A RFC 6585 deixa isso em aberto de propósito. O que não é opcional é que a chave saia de algo que o servidor verificou: uma chave feita com texto livre do cliente é uma forma de encher a memória do limitador.
>
> **O que ainda não é padrão.** Muitas APIs enviam, além de `Retry-After`, cabeçalhos que dizem quantas requisições restam na janela. Há um rascunho da IETF para isso, *RateLimit header fields for HTTP*, que define `RateLimit-Policy` e `RateLimit`; sua versão mais recente é a 11, de 23 de maio de 2026, e [continua sendo um rascunho](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/), não uma RFC. E as APIs grandes usam seus próprios nomes: a [API REST do GitHub](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api), por exemplo, responde `403` ou `429` quando um limite é excedido, com seus cabeçalhos `x-ratelimit-remaining` e `x-ratelimit-reset`, e pede para olhar primeiro `retry-after` se vier. Por isso o `revisor` só envia `Retry-After`, que sim é padrão, e por isso o curso ensina os outros como o que são: um padrão que cada API documenta, não um requisito do HTTP.

### 4.7 O `revisor` completo

#### 4.7.1 Os arquivos que mudam

Copie a pasta da Lição 3 como `~/curso-http/fig04_01/`. Oito arquivos são novos ou mudam. Primeiro os dois novos:

```ts
// fig04_01/operacion.ts — el modo mantenimiento: lo enciende y lo apaga quien opera el revisor.
import type { ServerResponse } from "node:http";
import { enviarVacio, fallar } from "./respuestas.ts";
import { leerJson, rechazarDatos, type Contexto } from "./servicios.ts";

let enMantenimiento = false;
const VUELVE_EN_S = 120;

// Si está en mantenimiento, responde 503 y devuelve true. /mantenimiento siempre se atiende.
export function atajarPorMantenimiento(ruta: string, respuesta: ServerResponse): boolean {
  if (!enMantenimiento || ruta === "/mantenimiento") return false;
  fallar(respuesta, 503, "el revisor está en mantenimiento", { "Retry-After": String(VUELVE_EN_S) });
  return true;
}

// PUT /mantenimiento con {"activo": true} o {"activo": false}. Solo la credencial admin.
export async function cambiarMantenimiento({ peticion, respuesta, credencial }: Contexto): Promise<void> {
  if (credencial.rol !== "admin") {
    fallar(respuesta, 403, "solo quien opera el revisor puede cambiar el mantenimiento");
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

`limitador.ts` está completo na seção 4.6.2. Os seis que mudam, completos:

```ts
// fig04_01/servidor.ts — la cara servidor del revisor: la API que administra los servicios observados.
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fallar } from "./respuestas.ts";
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
      fallar(respuesta, 500, `error interno; referencia ${referencia}`);
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
// fig04_01/cliente.ts — la cara cliente del revisor: consulta un servicio y clasifica lo que respondió.
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
// fig04_01/servicios.ts — lo que hace cada ruta de la API del revisor.
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
import { CuerpoDemasiadoGrande, enviarJson, enviarVacio, fallar, leerCuerpo, TOPE_CUERPO, type Cabeceras } from "./respuestas.ts";

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
    fallar(respuesta, 410, `el servicio ${id} se retiró y no va a volver`);
  } else {
    fallar(respuesta, 404, `no existe el servicio ${id}`);
  }
  return undefined;
}

// 415 si el cuerpo no se declara application/json. Va aparte de leerJson porque el PUT lo pregunta
// antes que If-Match: el 415 se sabe sin procesar el contenido, y el RFC 9110 (sección 13.2.1) dice que
// las precondiciones no se evalúan si sin ellas la respuesta no habría sido 2xx ni 412.
function esJson(peticion: IncomingMessage, respuesta: ServerResponse): boolean {
  const tipo = (peticion.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  if (tipo !== "application/json") {
    fallar(respuesta, 415, `el cuerpo debe ser application/json, no ${tipo === "" ? "(sin tipo)" : tipo}`, {
      Accept: "application/json",
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
      fallar(respuesta, 413, `el cuerpo pasa de ${TOPE_CUERPO} bytes`, { Connection: "close" });
      return undefined;
    }
    // si no, cae al 400 de abajo
  }
  fallar(respuesta, 400, "el cuerpo no es un objeto JSON");
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
  fallar(respuesta, 422, fallas.map((f) => `${f.campo}: ${f.detalle}`).join("\n"));
}

// SSRF: el revisor se conecta a la URL que alguien escribió. Se revisa al registrarla y otra vez
// antes de cada conexión (en cliente.ts). Si no se permite, ya respondió y devuelve false.
async function destinoPermitido(url: string, respuesta: ServerResponse): Promise<boolean> {
  const veredicto = await revisarDestino(url);
  if (veredicto.permitido) return true;
  fallar(respuesta, 422, `destino prohibido: ${veredicto.motivo}`);
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
    fallar(respuesta, 409, `ya existe un servicio llamado ${validos.nombre}: /servicios/${existente.id}`);
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
    fallar(respuesta, 428, "para cambiar un servicio manda If-Match con su ETag");
    return;
  }
  // If-Match se compara en fuerte (RFC 9110, secciones 13.1.1 y 8.8.3.2): una etiqueta W/ nunca coincide.
  // El detail no repite la cabecera que mandó el cliente: dice qué pasó y qué hacer.
  if (!hayCoincidencia(condicion, etiqueta(servicio), coincideFuerte)) {
    // Si solo coincide en débil, no es que el servicio haya cambiado: la etiqueta W/ no sirve para escribir.
    const detalle = hayCoincidencia(condicion, etiqueta(servicio), coincideDebil)
      ? "If-Match se compara en fuerte: una etiqueta débil (W/) no sirve para cambiar; manda la ETag tal como llegó"
      : "tu etiqueta ya no es la vigente: el servicio cambió o el revisor se reinició; vuelve a leerlo antes de cambiarlo";
    fallar(respuesta, 412, detalle);
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
    fallar(respuesta, 409, `ya existe un servicio llamado ${validos.nombre}: /servicios/${homonimo.id}`);
    return;
  }
  const cambiado = cambiarServicio(servicio.id, versionLeida, validos);
  if (cambiado === "conflicto") {
    fallar(respuesta, 412, "el servicio cambió mientras se atendía tu petición; vuelve a leerlo antes de cambiarlo");
    return;
  }
  if (cambiado === "retirado") {
    // Otra petición lo retiró mientras ésta esperaba: 410, como si hubiera llegado después del retiro.
    fallar(respuesta, 410, `el servicio ${servicio.id} se retiró y no va a volver`);
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
    fallar(respuesta, 429, `ya pediste ${REVISIONES_POR_VENTANA} revisiones en el último minuto`, {
      "Retry-After": String(decision.esperaS),
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
    fallar(respuesta, 404, `no existe la revisión ${parametros[0]}`);
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
    fallar(respuesta, 429, `ya pediste ${CONSULTAS_POR_VENTANA} consultas en vivo en el último minuto`, {
      "Retry-After": String(decision.esperaS),
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
      fallar(respuesta, 504, `el servicio ${servicio.id} no respondió en ${servicio.limiteMs} ms`);
      return;
    case "sin-conexion":
      fallar(respuesta, 502, `no se pudo conectar con el servicio ${servicio.id}`);
      return;
    case "destino-prohibido":
      fallar(respuesta, 422, `destino prohibido: ${consulta.motivo}`);
      return;
    case "respuesta-invalida":
      fallar(respuesta, 502, `el servicio ${servicio.id} no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP`);
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

Em `servicios.ts`, além do que já foi visto (`salud`, `informe` e os limites de `pedirRevision` e `salud`), `leerJson` agora é exportada, porque `operacion.ts` a usa para ler o corpo de `PUT /mantenimiento`. Todo o resto é a Lição 3.

```ts
// fig04_01/rutas.ts — la puerta de la API: qué ruta existe, qué método admite y quién puede usarlo.
import type { IncomingMessage, ServerResponse } from "node:http";
import { identificar, motivo, reto, type Credencial } from "./autenticacion.ts";
import { enviarVacio, fallar } from "./respuestas.ts";
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
    fallar(respuesta, 404, "no existe esa ruta");
    return;
  }

  // 2. ¿Admite este método?
  const nombreMetodo = peticion.method === "HEAD" ? "GET" : (peticion.method ?? "GET");
  // Object.hasOwn y no ruta.metodos[nombreMetodo] a secas: el método lo escribe el cliente, y un objeto
  // también «tiene» lo que hereda de Object.prototype (constructor, toString…). Igual que las credenciales.
  const metodo = Object.hasOwn(ruta.metodos, nombreMetodo) ? ruta.metodos[nombreMetodo] : undefined;
  if (metodo === undefined) {
    fallar(respuesta, 405, `${peticion.method} no se admite en ${url.pathname}`, { Allow: permitidos(ruta) });
    return;
  }

  // 3. ¿Quién eres?
  const identificacion = identificar(peticion);
  if (identificacion.tipo !== "valida") {
    const detalle = motivo(identificacion);
    fallar(respuesta, 401, detalle, { "WWW-Authenticate": reto(identificacion) });
    return;
  }

  // 4. ¿Puedes?
  if (!puede(identificacion.credencial, metodo)) {
    fallar(respuesta, 403, "tu credencial solo puede leer; para escribir pide una con rol de escritor");
    return;
  }

  // 5, 6 y 7. ¿Existe el recurso? ¿En qué formato viene? ¿Se puede leer? Lo decide cada manejador. Después, ¿se puede cumplir? (422)
  await metodo.manejador({ peticion, respuesta, parametros, credencial: identificacion.credencial });
}
```

```ts
// fig04_01/laboratorio.ts
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
// fig04_01/almacen.ts — los servicios que observa el revisor y las revisiones pedidas, en memoria.
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

Em `almacen.ts` há duas mudanças: `revisionesDe`, que `informe` usa, e os três serviços de inicialização novos no final do arquivo.

#### 4.7.2 Os arquivos que não mudam

Os demais são os da Lição 3, sem uma única mudança. Vão completos para que o `revisor` possa ser montado a partir desta lição:

```ts
// fig04_01/respuestas.ts — las tres formas de responder del revisor y la lectura del cuerpo.
import type { IncomingMessage, ServerResponse } from "node:http";

export type Cabeceras = Record<string, string>;

// Node trae los nombres viejos de estos dos códigos; aquí van los del registro de la IANA.
const FRASES: Partial<Record<number, string>> = { 413: "Content Too Large", 422: "Unprocessable Content" };

function escribirCabecera(respuesta: ServerResponse, codigo: number, cabeceras: Cabeceras): void {
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

// Un error: por ahora, una línea de texto. La lección 5 lo cambia por Problem Details.
export function fallar(respuesta: ServerResponse, codigo: number, detalle: string, cabeceras: Cabeceras = {}): void {
  const cuerpo = detalle + "\n";
  escribirCabecera(respuesta, codigo, {
    ...cabeceras,
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": String(Buffer.byteLength(cuerpo)),
  });
  respuesta.end(cuerpo);
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
// fig04_01/autenticacion.ts — quién eres (la credencial) y qué puedes hacer (el rol).
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
// fig04_01/destinos.ts — a dónde puede conectarse el revisor. Defensa contra SSRF.
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
// fig04_01/etiquetas.ts — leer y comparar etiquetas (ETag) como pide el RFC 9110.
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
// fig04_01/versiones.ts — las versiones viejas de la API: /v1 está desaprobada y /v0 ya se retiró.
import type { ServerResponse } from "node:http";
import { listarServicios, type Servicio } from "./almacen.ts";
import { enviarJson, fallar, type Cabeceras } from "./respuestas.ts";
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
  fallar(respuesta, 410, "la versión 0 de la API se retiró el 31 de enero de 2026; usa /servicios");
  return true;
}
```

```json fig04_01/package.json
{
  "type": "module"
}
```

#### 4.7.3 A execução completa

Com o laboratório e o `revisor` recém-iniciados (seção 4.1.3), estas são todas as requisições da lição, em ordem, com o que responderam. Estão aqui reunidas para que possam ser comparadas, de ponta a ponta, com as obtidas na máquina local:

```text
$ curl -i http://127.0.0.1:18081/basura
curl: (1) Received HTTP/0.9 when not allowed

$ curl -i -m 1 http://127.0.0.1:18081/lento/3000
curl: (28) Operation timed out after 1001 milliseconds with 0 bytes received

$ curl -i http://127.0.0.1:18081/cortar
curl: (52) Empty reply from server

$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia affc3b8a-5ab9-42f5-8b37-2face1f8eafd

$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia bf0e3b0a-790f-4625-80e7-017b0bcfa403

$ curl -i http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 35
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":1,"codigo":200,"ms":8}

$ curl -i http://127.0.0.1:18080/servicios/2/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 35
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":2,"codigo":503,"ms":1}

$ curl -i http://127.0.0.1:18080/servicios/4/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 38
Date: Wed, 21 Oct 2026 13:19:08 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":4,"codigo":200,"ms":1503}

$ curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 504 Gateway Timeout
Content-Type: text/plain; charset=utf-8
Content-Length: 39
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 5 no respondió en 1000 ms
tardó 1.004405 s

$ curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/6/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 502 Bad Gateway
Content-Type: text/plain; charset=utf-8
Content-Length: 102
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 6 no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP
tardó 0.002184 s

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"colgado","url":"http://127.0.0.1:18081/cortar"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-6db25d01"
Content-Type: application/json
Content-Length: 83
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"colgado","url":"http://127.0.0.1:18081/cortar","limite_ms":2000}

$ curl -i http://127.0.0.1:18080/servicios/7/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 502 Bad Gateway
Content-Type: text/plain; charset=utf-8
Content-Length: 102
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 7 no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"activo":true}'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 59
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

solo quien opera el revisor puede cambiar el mantenimiento

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":true}'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a'
HTTP/1.1 503 Service Unavailable
Retry-After: 120
Content-Type: text/plain; charset=utf-8
Content-Length: 34
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el revisor está en mantenimiento

$ curl -i http://127.0.0.1:18080/no-existe
HTTP/1.1 503 Service Unavailable
Retry-After: 120
Content-Type: text/plain; charset=utf-8
Content-Length: 34
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el revisor está en mantenimiento

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":false}'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a'
200

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: text/plain; charset=utf-8
Content-Length: 45
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 revisiones en el último minuto

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/4/revisiones -H 'Authorization: Bearer admin'
202

$ curl -i http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 429 Too Many Requests
Retry-After: 58
Content-Type: text/plain; charset=utf-8
Content-Length: 52
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 consultas en vivo en el último minuto

$ for id in 1 2 3 4 5 6 7 8 9 10; do curl -sS -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:18080/servicios/$id/revisiones -H 'Authorization: Bearer escritura-b'; done; echo
404 404 202 429 429 429 429 429 429 429 

$ sleep 20
$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
HTTP/1.1 429 Too Many Requests
Retry-After: 40
Content-Type: text/plain; charset=utf-8
Content-Length: 45
Date: Wed, 21 Oct 2026 13:19:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 revisiones en el último minuto

$ curl http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer lectura-a'
{"id":1,"servicio":2,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":503,"ms":1,"detalle":"503 (reintentar en 120 s)"}}

$ curl http://127.0.0.1:18080/revisiones/4 -H 'Authorization: Bearer lectura-a'
{"id":4,"servicio":4,"estado":"terminada","resultado":{"estado":"LENTO","codigo":200,"ms":1501,"detalle":"200"}}

$ curl -i http://127.0.0.1:18080/servicios/2/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 54
Date: Wed, 21 Oct 2026 13:19:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":2,"revisiones":3,"ultimo_estado":"CAIDO"}
```

E isto foi o que o terminal do `revisor` escreveu durante toda a execução. Observe que os únicos stack traces são os dos dois `500`, e que cada um começa com a referência que o cliente recebeu:

```text
revisor en http://127.0.0.1:18080
GET /servicios/1/informe
error affc3b8a-5ab9-42f5-8b37-2face1f8eafd en GET /servicios/1/informe: TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:304:28)
    at atender (file://<carpeta>/rutas.ts:104:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:23:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:35:44)
GET /servicios/1/informe
error bf0e3b0a-790f-4625-80e7-017b0bcfa403 en GET /servicios/1/informe: TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:304:28)
    at atender (file://<carpeta>/rutas.ts:104:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:23:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:35:44)
GET /servicios/1/salud
GET /servicios/2/salud
GET /servicios/4/salud
GET /servicios/5/salud
GET /servicios/6/salud
POST /servicios
GET /servicios/7/salud
PUT /mantenimiento
PUT /mantenimiento
operación: mantenimiento encendido
GET /servicios
GET /no-existe
PUT /mantenimiento
operación: mantenimiento apagado
GET /servicios
POST /servicios/2/revisiones
POST /servicios/2/revisiones
POST /servicios/2/revisiones
POST /servicios/2/revisiones
POST /servicios/4/revisiones
GET /servicios/1/salud
POST /servicios/1/revisiones
POST /servicios/2/revisiones
POST /servicios/3/revisiones
POST /servicios/4/revisiones
POST /servicios/5/revisiones
POST /servicios/6/revisiones
POST /servicios/7/revisiones
POST /servicios/8/revisiones
POST /servicios/9/revisiones
POST /servicios/10/revisiones
POST /servicios/2/revisiones
GET /revisiones/1
GET /revisiones/4
GET /servicios/2/informe
```

#### 4.7.4 Verificar os tipos com `tsc` (opcional)

Como nas lições anteriores, os programas rodam com `node archivo.ts` sem compilar nada, e o `tsc` serve apenas para verificar os tipos. A partir da pasta `fig04_01/`:

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

Não imprime nada se tudo estiver bem. Os treze arquivos de `fig04_01/`, `fig04_02.ts`, `fig04_03.ts`, as duas versões de `defectos/` e as soluções de `ejercicios/` passam sem erros. Observe o que isso significa para o defeito de `informe`: ele passa no `tsc` em modo estrito. Os tipos dizem qual é a forma dos dados, não se eles existem; um `as` tira do TypeScript a oportunidade de avisar.

## O erro a ser observado

### O stack trace que viaja

Este é o `catch` que quase todo mundo escreve da primeira vez, porque é o mais útil enquanto se programa: se algo falhar, mande tudo. Para provocá-lo, copie a pasta `fig04_01/` como `rota/` e troque em `rota/servidor.ts` a função `atenderSinFiltrar` por esta (é um fragmento; a versão completa está em `defectos/pila/servidor.ts`, que avisa na primeira linha que não deve ser copiada):

```ts
async function atenderSinFiltrar(peticion: IncomingMessage, respuesta: ServerResponse): Promise<void> {
  try {
    await atender(peticion, respuesta);
  } catch (error) {
    const pila = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error(`error en ${peticion.method} ${peticion.url}`);
    if (!respuesta.headersSent) {
      fallar(respuesta, 500, pila);
    } else {
      respuesta.destroy();
    }
  }
}
```

Inicie o laboratório e o `revisor` a partir de `rota/` e peça o relatório do serviço 1, que não tem revisões:

```text
$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 865
Date: Wed, 21 Oct 2026 13:19:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:304:28)
    at atender (file://<carpeta>/rutas.ts:104:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:11:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:23:44)
    at Server.emit (node:events:508:28)
    at parserOnIncoming (node:_http_server:1210:12)
    at HTTPParser.parserOnHeadersComplete (node:_http_common:125:17)
```

(A pasta da máquina aparece como `<carpeta>`, como no terminal do `revisor`; o `Content-Length: 865` conta a pasta real, que é mais longa.)

O código está correto: `500`. Todo o resto é um presente para quem não deveria recebê-lo. Convém lê-lo como o leria alguém que quer atacar a API:

- **Os caminhos.** Cada frame traz a pasta completa onde vive o programa. Em um servidor real, isso informa qual usuário executa o processo, como o projeto se chama no disco e onde procurar caso se encontre outra forma de ler arquivos.
- **Os nomes internos.** `servicios.ts`, `rutas.ts`, `servidor.ts`, a função `informe`, o campo `resultado`. É o mapa do código, de graça.
- **A tecnologia e sua versão.** `node:events:508:28` e `node:_http_server:1210:12` são frames do Node, e seus números de linha mudam a cada versão: quem conhece o Node pode deduzir qual versão está em execução e buscar as vulnerabilidades conhecidas dela.
- **Como provocá-lo outra vez.** A mensagem diz que se leu `resultado` sobre `undefined`. Junto com a rota solicitada, diz a quem a recebeu exatamente qual condição derruba o servidor, e permite repeti-la quando quiser.

E observe o terminal do `revisor` nesta versão:

```text
revisor en http://127.0.0.1:18080
GET /servicios/1/informe
error en GET /servicios/1/informe
```

Uma linha, sem referência e sem stack trace. Este `catch` deu tudo ao cliente e quase nada a quem opera. Se o cliente não relatar o corpo que recebeu, ninguém do lado do servidor sabe o que aconteceu. É o erro às avessas, completo: a informação está do lado errado.

A correção é o `atenderSinFiltrar` de `fig04_01/`: o stack trace vai para o terminal, recortado aos frames do curso, e ao cliente só chega a referência. Se surgir o pensamento «mas em desenvolvimento me serve ver o stack trace na resposta», a resposta é que ele está no terminal, ao lado, com a mesma informação; e que um `catch` que se comporta de forma diferente em desenvolvimento e em produção é um `catch` cuja versão de produção nunca foi testada. Os programas de `rota/` devem ser parados ao terminar.

### Tudo é `500`

O segundo erro é mais sutil, porque a resposta é impecável na forma e falsa no fundo. Copie outra vez `fig04_01/` como `rota2/` e troque em `rota2/servicios.ts` a função `salud` por esta, que consulta com `fetch` diretamente, sem passar por `consultar` (a versão completa está em `defectos/sin-pasarela/servicios.ts`, com o mesmo aviso na primeira linha):

```ts
export async function salud({ respuesta, parametros, credencial }: Contexto): Promise<void> {
  // La consulta en vivo también sale a la red, igual que una revisión: sin límite, el revisor serviría
  // para golpear un servicio ajeno a través de él. Cuenta por credencial, antes de buscar el servicio,
  // en una ventana aparte de la de las revisiones.
  const decision = permitir(`salud:${credencial.nombre}`, CONSULTAS_POR_VENTANA, VENTANA_MS);
  if (!decision.permitido) {
    fallar(respuesta, 429, `ya pediste ${CONSULTAS_POR_VENTANA} consultas en vivo en el último minuto`, {
      "Retry-After": String(decision.esperaS),
    });
    return;
  }
  const servicio = encontrar(parametros[0], credencial, respuesta);
  if (servicio === undefined) return;
  // DEFECTO A PROPÓSITO: llama a fetch directo y no clasifica lo que puede salir mal. Si el servicio
  // no responde a tiempo o no responde HTTP, fetch lanza, y la excepción llega a servidor.ts.
  const veredicto = await revisarDestino(servicio.url);
  if (!veredicto.permitido) {
    fallar(respuesta, 422, `destino prohibido: ${veredicto.motivo}`);
    return;
  }
  const inicio = performance.now();
  const contestacion = await fetch(servicio.url, { redirect: "manual", signal: AbortSignal.timeout(servicio.limiteMs) });
  await contestacion.body?.cancel();
  enviarJson(respuesta, 200, { servicio: servicio.id, codigo: contestacion.status, ms: Math.round(performance.now() - inicio) });
}
```

Lê-se bem, e faz o certo quando o serviço responde. Inicie o laboratório e o `revisor` a partir de `rota2/` e peça a saúde dos serviços 2, 5 e 6:

```text
$ curl -i http://127.0.0.1:18080/servicios/2/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 36
Date: Wed, 21 Oct 2026 13:19:32 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":2,"codigo":503,"ms":20}

$ curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:33 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia 53423d0e-11e2-4ce0-befe-6f701044a854
tardó 1.002529 s

$ curl -i http://127.0.0.1:18080/servicios/6/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:33 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia 3ec30ef1-4589-44c0-a95c-00c1195b86d9
```

O serviço 2 sai igual a antes, `200` com seu `503` dentro. Mas o 5, que não respondeu a tempo, e o 6, que respondeu lixo, saem os dois como `500`, com referência e sem stack trace. A rede de segurança de `servidor.ts` fez bem o trabalho dela: capturou uma exceção que ninguém esperava, não contou nada e deixou o fio no terminal:

```text
revisor en http://127.0.0.1:18080
GET /servicios/2/salud
GET /servicios/5/salud
error 53423d0e-11e2-4ce0-befe-6f701044a854 en GET /servicios/5/salud: TimeoutError: The operation was aborted due to timeout
GET /servicios/6/salud
error 3ec30ef1-4589-44c0-a95c-00c1195b86d9 en GET /servicios/6/salud: TypeError: fetch failed
```

O problema é que **sim, era esperado**. Que um serviço alheio não responda a tempo, ou responda lixo, é a coisa mais normal do mundo para um programa cujo trabalho é consultar serviços alheios. Responder `500` diz a quem opera «o código tem um erro», e o manda procurar em `servicios.ts` um defeito que não existe, enquanto o problema real está no serviço de relatórios e no de faturamento. É exatamente a confusão das 19h20 da cena do início. E observe a segunda linha de erro: `TypeError: fetch failed`, sem um único frame do curso. O stack trace do `fetch` vive inteiro dentro do Node, e `pilaDelCurso` o recortou todo. Nem o terminal diz onde aconteceu.

A correção é o `salud` de `fig04_01/`: perguntar a `consultar`, que converte cada forma de falhar em um desfecho com nome, e escolher um código para cada um. **O que se pode prever não se deixa chegar à rede de segurança do `500`**: a rede é para o que de verdade ninguém previu. Os programas de `rota2/` devem ser parados ao terminar.

## O que se costuma fazer de errado

**`500` para tudo o que dá errado.** É o erro que esta lição existe para evitar. Um `500` por uma dependência lenta, por uma manutenção ou por um limite de requisições manda quem opera procurar no próprio código, e diz ao cliente «não sei o que aconteceu» quando se sabia.

**O stack trace, o SQL ou a mensagem da exceção no corpo.** O primeiro é o erro de «O stack trace que viaja». O último é o que mais escapa, porque parece inofensivo: o texto de uma exceção é escrito por quem a lançou, e pode trazer uma consulta, um caminho ou um endereço interno.

**Um `500` sem nada que permita encontrá-lo.** O contrário do anterior: calar tudo, inclusive do lado de quem opera. Um `500` sem referência, em um servidor que atende milhares de requisições por minuto, não pode ser associado a nenhuma linha do log.

**Um `503` sem `Retry-After`, ou com um inventado.** A RFC não obriga a enviá-lo, mas um `503` sem ele deixa o cliente adivinhando quanto esperar, e cada cliente adivinha de um jeito. E um `Retry-After: 1` colocado «por via das dúvidas» em uma manutenção de duas horas faz todos os clientes voltarem a cada segundo, que é o contrário do que se queria.

**Um `503` permanente.** O `503` promete que é temporário. Para algo que foi retirado para sempre, o código é `410` (Lição 3); para algo que não existe, `404`.

**Responder com o código do serviço de trás.** Se o serviço de pagamentos responde `503` e a consulta de saúde responde `503`, qualquer máquina do caminho conclui que o que está fora do ar é a própria API. A consulta funcionou: é um `200` com o `503` dentro, como em 4.4.3. E ao contrário, se a API usa outro serviço para atender, um `404` desse serviço não é um `404` da API: não se reenviam ao cliente os códigos de outro.

**Um `429` sem `Retry-After`, ou um limite que ninguém documentou.** O cliente que recebe um `429` sem saber quanto esperar tenta de novo de imediato, e volta a receber `429`. A RFC 6585 deixa em aberto o quanto, o a cada quanto tempo e o por quem; deixá-los também sem documentar converte o limite em um mistério que cada cliente descobre na marra.

**`429` para uma saturação que aquele cliente não causou.** Se o servidor está saturado por todos, o código é `503`. O `429` acusa um cliente concreto de passar do limite.

**Um limite cuja chave sai de texto livre do cliente.** Limitar por um identificador que o cliente pode inventar sem custo (um id que não existe, um cabeçalho que ninguém verificou) dá a qualquer um uma forma de criar chaves sem fim e encher a memória do limitador.

**Esperar por uma dependência sem limite de tempo.** Sem `AbortSignal.timeout`, uma consulta a um serviço travado espera para sempre, e cada requisição que chega nesse meio-tempo ocupa mais uma conexão. Sem limite de tempo não há `504`: há um servidor que vai ficando sem recursos.

## Exercícios

Os quatro se corrigem sozinhos: cada um termina com uma execução que diz se a previsão estava certa. Escreva a previsão no [diário de bordo](bitacora.md) **antes** de rodar qualquer coisa. Para o 1, o 3 e o 4 é preciso o laboratório e o `revisor` de 4.7 rodando, recém-iniciados.

### Exercício 1 — Quem tem a culpa?

Preveja o código de cada uma destas seis requisições e, para cada uma, quem tem a culpa e quem pode corrigir. Cuidado: nem todas são erros do servidor.

```bash
curl -i http://127.0.0.1:18080/servicios/3/salud -H 'Authorization: Bearer lectura-a'
curl -i http://127.0.0.1:18080/servicios/4/informe -H 'Authorization: Bearer lectura-a'
curl -i -X POST http://127.0.0.1:18080/servicios/5/revisiones -H 'Authorization: Bearer lectura-a'
curl -i http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer escritura-a'
curl -i http://127.0.0.1:18080/servicios/2/salud -H 'Authorization: Bearer escritura-a'
curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":"si"}'
```

Depois rode-as e compare.

### Exercício 2 — Um `Retry-After` que não é válido

Em 4.5.3 viu-se que `segundosDeEspera` não usa `Date.parse`. Este exercício mostra o porquê. Escreva uma versão ingênua, `segundosConDateParse`, que aceite os dígitos e passe todo o resto para `Date.parse`, e compare-a com a do `revisor` em um programa (`ejercicios/ej2.ts`) com estes nove valores:

- `"120"`, `"1.5"`, `"-1"` e `"12 30"`
- `"Xyz, 21 Oct 2026 10:00:00 GMT"` e `"Wed, 32 Oct 2026 10:00:00 GMT"`
- a mesma data, um minuto no futuro, nas três formas de HTTP-date: a preferida, a da RFC 850 e a de `asctime`

Antes de rodar qualquer coisa, decida quais são valores válidos de `Retry-After` segundo a gramática da RFC 9110, e preveja o que cada versão devolve com cada um. Dica: a gramática da RFC enumera os dias e os meses, e diz que uma data HTTP sempre está em GMT; `Date.parse` não sabe nada disso.

### Exercício 3 — O enumerador contra o limite

Com o laboratório e o `revisor` de 4.7 recém-iniciados, preveja quais códigos `escritura-b` recebe ao pedir revisões dos ids 1 a 10, um após o outro. Depois, `escritura-a` pede três revisões do serviço 2, e logo em seguida `admin` pede uma do mesmo serviço: o que `admin` recebe?

```bash
for id in 1 2 3 4 5 6 7 8 9 10; do curl -sS -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:18080/servicios/$id/revisiones -H 'Authorization: Bearer escritura-b'; done; echo
curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer admin'
```

Agora faça uma cópia de `fig04_01/` e troque em seu `servicios.ts` o limite de `pedirRevision` pelo que parece mais natural: **por serviço** (a chave `revisiones:` mais o id do serviço) e **depois** de `encontrar`. A pasta `fig04_01/` original não deve ser tocada, pois é o `revisor` que a Lição 5 recebe. Inicie a cópia, repita as mesmas requisições e preveja outra vez. Qual das duas versões freia o enumerador? Qual pune `admin` pelo que `escritura-a` fez?

### Exercício 4 — Sem laboratório

Pare o laboratório (`Ctrl+C` no terminal dele) e deixe o `revisor` em execução. Preveja o que estas requisições respondem, e quanto a segunda demora:

```bash
curl -i http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'
curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer lectura-a'
curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/1/revisiones -H 'Authorization: Bearer escritura-a'
sleep 2
curl http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer lectura-a'
```

O serviço 5 dava `504` em 4.4.3. Continua dando `504`?

## Soluções

### Solução 1

```text
$ curl -i http://127.0.0.1:18080/servicios/3/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:19:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 3

$ curl -i http://127.0.0.1:18080/servicios/4/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia d88e2544-137d-436f-b5d2-c206d50ca348

$ curl -i -X POST http://127.0.0.1:18080/servicios/5/revisiones -H 'Authorization: Bearer lectura-a'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:19:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu credencial solo puede leer; para escribir pide una con rol de escritor

$ curl -i http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 504 Gateway Timeout
Content-Type: text/plain; charset=utf-8
Content-Length: 39
Date: Wed, 21 Oct 2026 13:19:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 5 no respondió en 1000 ms

$ curl -i http://127.0.0.1:18080/servicios/2/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 35
Date: Wed, 21 Oct 2026 13:19:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":2,"codigo":503,"ms":5}

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":"si"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 30
Date: Wed, 21 Oct 2026 13:19:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

activo: debe ser true o false
```

Em ordem:

- **`404`**: o serviço 3 é da equipe b, e para `lectura-a` não existe. É um erro do cliente, o mesmo da Lição 2, e a consulta de saúde nunca saiu para a rede. Culpa e correção: do cliente.
- **`500`**: o serviço 4 (`inventario`) não tem revisões concluídas, e `informe` estoura, igual ao que ocorreu com o 1. Culpa: o código do `revisor`. Correção: quem o opera, corrigindo `informe` (a referência da resposta leva ao stack trace no terminal).
- **`403`**: pedir uma revisão é escrever, e `lectura-a` só lê. Não é um `429`: a pergunta 4 do ponto de entrada é respondida antes do limite, que vive dentro do handler. Culpa e correção: do cliente, ou de quem lhe deu essa credencial.
- **`504`**: `reportes` não responde em 1000 ms. Culpa: o serviço de relatórios. Correção: quem o opera. O `revisor` não tem nada a corrigir.
- **`200`**: `pagos` respondeu `503`, e o `revisor` informou isso com sucesso. Ninguém errou nesta requisição; a má notícia é o dado que ela traz.
- **`422`**: `"si"` não é um booleano. O `admin` passou pelo ponto de entrada e pela verificação de papel, e o corpo pôde ser lido, mas não pode ser cumprido: é a política `400`/`422` da Lição 3. Culpa e correção: do cliente.

Apenas duas das seis são erros do servidor, e são de dois servidores distintos. Quem errou a terceira deve rever a ordem: a permissão do papel é perguntada no ponto de entrada, e o limite, dentro do handler.

### Solução 2

Apenas `"120"` é um `delay-seconds` válido (`1*DIGIT`). `"1.5"`, `"-1"` e `"12 30"` não são nem segundos nem uma data HTTP. `"Xyz, …"` tem a forma da data preferida, mas `Xyz` não é um dia: a RFC enumera os sete. `"Wed, 32 Oct …"` tem a forma correta, mas 32 de outubro não existe. As três últimas são válidas: a preferida e as duas obsoletas que quem lê **deve** aceitar (seção 5.6.7). Uma função correta devolve `120`, cinco `null` e uns `60` segundos três vezes. Este programa compara as duas:

```ts
// ejercicios/ej2.ts — Retry-After: la lectura del revisor contra una ingenua que confía en Date.parse.
import { segundosDeEspera } from "../fig04_01/cliente.ts";

// La versión ingenua: dígitos, o lo que Date.parse quiera entender como fecha.
function segundosConDateParse(valor: string): number | null {
  if (/^\d+$/.test(valor)) return Number(valor);
  const fecha = Date.parse(valor);
  return Number.isNaN(fecha) ? null : Math.max(0, Math.ceil((fecha - Date.now()) / 1000));
}

// La misma fecha, un minuto adelante, en las tres formas de HTTP-date (RFC 9110, sección 5.6.7).
const enUnMinuto = new Date(Math.ceil((Date.now() + 60_000) / 1000) * 1000);
const imf = enUnMinuto.toUTCString();
const [, dia, num, mes, anio, hora] = /^(\w{3}), (\d{2}) (\w{3}) (\d{4}) (\S+) GMT$/.exec(imf) ?? [];
const DIAS_LARGOS: Record<string, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};
const rfc850 = `${DIAS_LARGOS[dia]}, ${num}-${mes}-${anio.slice(2)} ${hora} GMT`;
const asctime = `${dia} ${mes} ${num.replace(/^0/, " ")} ${hora} ${anio}`;

const VALORES = ["120", "1.5", "-1", "12 30", "Xyz, 21 Oct 2026 10:00:00 GMT", "Wed, 32 Oct 2026 10:00:00 GMT", imf, rfc850, asctime];

console.log(`${"valor".padEnd(36)}${"Date.parse".padStart(11)}${"revisor".padStart(9)}`);
for (const valor of VALORES) {
  const ingenua = segundosConDateParse(valor);
  console.log(`${JSON.stringify(valor).padEnd(36)}${String(ingenua).padStart(11)}${String(segundosDeEspera(valor)).padStart(9)}`);
}
```

```text
$ node ejercicios/ej2.ts
valor                                Date.parse  revisor
"120"                                       120      120
"1.5"                                         0     null
"-1"                                          0     null
"12 30"                                       0     null
"Xyz, 21 Oct 2026 10:00:00 GMT"               0     null
"Wed, 32 Oct 2026 10:00:00 GMT"            null     null
"Wed, 21 Oct 2026 13:20:57 GMT"              61       61
"Wednesday, 21-Oct-26 13:20:57 GMT"          61       61
"Wed Oct 21 13:20:57 2026"                21661       61
```

(As três datas válidas dão `61` e não `60` porque o programa arredonda «dali a um minuto» para o segundo seguinte, e `segundosDeEspera` arredonda para cima.)

A coluna do `revisor` está correta nas nove linhas. A de `Date.parse` tem duas classes de erros.

**Aceita o que não é uma data.** Com `"1.5"`, `"-1"`, `"12 30"` e `"Xyz, …"`, a versão ingênua devolve **`0`**, «pode tentar já». Não são dígitos, então ela tenta lê-los como data, e o `Date.parse` do V8 é tão permissivo que os aceita: `"1.5"` é lido como uma data de 2001, e em `"Xyz, …"` nem sequer olha o nome do dia. Como essas datas já passaram, o resultado é `0`. Um servidor que envia um `Retry-After` mal escrito obtém o contrário do que queria: um cliente que insiste de imediato. A versão do `revisor` devolve `null`, que é o honesto: «não me disseram quanto esperar». (Com `"Wed, 32 Oct …"`, ao contrário, o `Date.parse` sim se recusou; `Date.UTC`, que `fechaHttp` usa, o teria aceitado, e por isso `fechaHttp` verifica a data no final.)

**Lê `asctime` no horário local.** Com a data `asctime`, a versão ingênua devolve **`21661`**, umas seis horas, e a do `revisor`, `61`. O formato `asctime` não escreve o fuso horário, e a RFC diz que é GMT; o `Date.parse` o lê como horário **local**. Esta execução foi feita em uma máquina em UTC−6, então a data ficou seis horas no futuro. Em uma máquina em UTC, as duas colunas dariam o mesmo: é uma falha que depende de onde o programa roda, o pior tipo de falha, porque não se vê na máquina de quem a escreveu.

A lição para o código de cada um: **leia um cabeçalho com a gramática dele, não com a função mais próxima que «parece funcionar»**. `Date.parse` serve para ler uma data que já se sabe que é uma data, e no fuso que já se sabe qual é.

### Solução 3

Com o `revisor` de `fig04_01/`:

```text
$ for id in 1 2 3 4 5 6 7 8 9 10; do curl -sS -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:18080/servicios/$id/revisiones -H 'Authorization: Bearer escritura-b'; done; echo
404 404 202 429 429 429 429 429 429 429 

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer admin'
HTTP/1.1 202 Accepted
Location: /revisiones/5
Content-Type: application/json
Content-Length: 60
Date: Wed, 21 Oct 2026 13:19:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":5,"servicio":2,"estado":"pendiente","resultado":null}
```

O enumerador recebe `404 404 202` e depois `429` sete vezes: as três primeiras requisições encheram a janela dele, ainda que duas fossem `404`, porque o limite é consultado antes de buscar o serviço e conta por credencial. E `admin` recebe `202`: o que `escritura-a` gastou, outra credencial não paga.

Com a cópia, em que o limite conta por serviço e é consultado depois de `encontrar` (o arquivo completo está em `ejercicios/ej3/servicios.ts`):

```ts
export function pedirRevision({ respuesta, parametros, credencial }: Contexto): void {
  const servicio = encontrar(parametros[0], credencial, respuesta);
  if (servicio === undefined) return;
  // Ejercicio 3: el límite como estaba antes, por servicio y después de encontrar. NO es el del revisor.
  const decision = permitir(`revisiones:${servicio.id}`, REVISIONES_POR_VENTANA, VENTANA_MS);
  if (!decision.permitido) {
    fallar(respuesta, 429, `ya pediste ${REVISIONES_POR_VENTANA} revisiones de este servicio en el último minuto`, {
      "Retry-After": String(decision.esperaS),
    });
    return;
  }
  const revision = crearRevision(servicio.id);
  setTimeout(async () => {
    terminarRevision(revision.id, await revisar(servicio.url, servicio.limiteMs));
  }, ESPERA_EN_COLA_MS);
  enviarJson(respuesta, 202, representarRevision(revision), { Location: `/revisiones/${revision.id}` });
}
```

```text
$ for id in 1 2 3 4 5 6 7 8 9 10; do curl -sS -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:18080/servicios/$id/revisiones -H 'Authorization: Bearer escritura-b'; done; echo
404 404 202 404 404 404 404 404 404 404 

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer admin'
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: text/plain; charset=utf-8
Content-Length: 62
Date: Wed, 21 Oct 2026 13:19:37 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 revisiones de este servicio en el último minuto
```

Os dois resultados se invertem. O enumerador percorre os dez ids sem um único `429`: cada `404` sai de `encontrar` antes de tocar o limitador, e o único que o toca é o 3, uma vez. Com cem mil ids seria igual. E `admin` recebe `429` com `Retry-After: 60`, por três revisões que outra pessoa pediu: o código o acusa de um ritmo que não foi dele. A versão «natural» tem os dois defeitos ao mesmo tempo, e por isso o `revisor` não a usa. A cópia deve ser parada ao terminar.

### Solução 4

```text
$ curl -i http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 502 Bad Gateway
Content-Type: text/plain; charset=utf-8
Content-Length: 38
Date: Wed, 21 Oct 2026 13:19:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no se pudo conectar con el servicio 1

$ curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 502 Bad Gateway
Content-Type: text/plain; charset=utf-8
Content-Length: 38
Date: Wed, 21 Oct 2026 13:19:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no se pudo conectar con el servicio 5
tardó 0.001450 s

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/1/revisiones -H 'Authorization: Bearer escritura-a'
202

$ sleep 2
$ curl http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer lectura-a'
{"id":1,"servicio":1,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":null,"ms":null,"detalle":"sin conexión"}}
```

Os dois são `502`, «não foi possível conectar»: com o laboratório parado, ninguém escuta na porta 18081, a conexão é recusada (`ECONNREFUSED`) e `consultar` a classifica como `sin-conexion`. **O serviço 5 já não dá `504`**: dá `502`, e em menos de 2 milissegundos (`0.001450 s`), não em 1000. O `504` precisa que alguém aceite a conexão e não responda; aqui ninguém a aceitou, e a tentativa terminou na hora. O mesmo serviço, com o mesmo limite, pode produzir dois códigos distintos conforme **como** falha o que está atrás. E a revisão pedida com o laboratório fora do ar ficou `CAIDO` com `"detalle":"sin conexión"`, sem código e sem milissegundos: não houve resposta, e o resultado não inventa uma. O laboratório deve ser iniciado de novo ao terminar.

## Critérios de sucesso

- [ ] Para cada um dos cinco códigos da lição, dá para dizer de memória quem tem a culpa, quem pode corrigir e o que o cliente faz.
- [ ] `curl -i` em `/servicios/1/informe`, com o `revisor` recém-iniciado, dá `500` com `error interno; referencia <uuid>`, e essa referência é encontrada no terminal, com o stack trace que começa em `servicios.ts`.
- [ ] `/servicios/2/salud` dá `200` com `"codigo":503`, e dá para explicar por que não é um `503`.
- [ ] `/servicios/5/salud` dá `504` em pouco mais de um segundo, e `/servicios/6/salud` dá `502` quase de imediato.
- [ ] Com o modo de manutenção ativado por `admin`, qualquer requisição, inclusive a uma rota que não existe e sem credencial, dá `503` com `Retry-After: 120`; e `PUT /mantenimiento` com `escritura-a` dá `403`.
- [ ] A quarta revisão pedida com a mesma credencial em um minuto dá `429` com `Retry-After: 60`, e vinte segundos depois, com um `Retry-After` menor; uma revisão com outra credencial continua dando `202`.
- [ ] `escritura-b` pedindo revisões dos ids 1 a 10 recebe `404 404 202` e depois `429`, e dá para explicar por que um limite por serviço não o frearia.
- [ ] Dá para explicar, com a execução de `fig04_02.ts`, por que uma janela fixa de 3 por segundo deixa passar 5 em menos de 70 ms.
- [ ] Dá para explicar o que um stack trace no corpo de um `500` revela, com a execução de `defectos/pila/`.
- [ ] Ao terminar, não resta nenhum programa escutando: `curl -i http://127.0.0.1:18080/` e `curl -i http://127.0.0.1:18081/codigo/200` dão os dois o erro 7.

## Resumo

Responda sem olhar a lição:

1. Que duas perguntas é preciso responder diante de qualquer falha, e o que respondem o `429`, o `500`, o `502`, o `503` e o `504`?
2. Por que o `429` é um `4xx`, se fala de capacidade? E por que o `503` é um `5xx`, se o servidor funciona?
3. Que condição o `502` e o `504` compartilham na RFC 9110, e o que os separa?
4. Por que a consulta de saúde de um serviço que responde `503` é um `200`?
5. Quais são as duas formas de `Retry-After`, e por que `1.5` não é um valor válido?
6. O que vai no corpo de um `500`, o que vai no terminal, e o que os une?
7. Por que o limite de revisões conta por credencial e é consultado antes de `encontrar`? O que aconteceria com um limite por serviço?
8. Que defeito tem a janela fixa, e quais algoritmos o evitam?

## Fontes

Todas foram consultadas em 21 de outubro de 2026.

1. [RFC 9110, *HTTP Semantics*, seção 15.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6): a família `5xx`, «o servidor sabe que errou ou não é capaz», e a explicação de se a condição é temporária ou permanente.
2. [RFC 9110, seção 15.6.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.1): o `500`, uma condição inesperada que impediu o cumprimento da requisição.
3. [RFC 9110, seção 15.6.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.3): o `502`, uma resposta inválida recebida enquanto se atuava como gateway ou proxy; e a [seção 3.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-3.7): o que é um gateway e o que é um proxy, e os termos *inbound* e *upstream*.
4. [RFC 9110, seção 15.6.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.4): o `503`, sobrecarga temporária ou manutenção programada, `Retry-After` opcional, e a nota de que um servidor saturado pode simplesmente recusar a conexão.
5. [RFC 9110, seção 15.6.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.5): o `504`, uma resposta que não chegou a tempo enquanto se atuava como gateway ou proxy.
6. [RFC 9110, seção 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3): `Retry-After = HTTP-date / delay-seconds`, `delay-seconds = 1*DIGIT`, e seu sentido com um `503`; e a [seção 5.6.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7): os três formatos da data HTTP, que quem lê deve aceitar.
7. [RFC 6585, *Additional HTTP Status Codes*, seção 4](https://www.rfc-editor.org/rfc/rfc6585.html#section-4): o `429`, «requisições demais em um tempo dado», `Retry-After` opcional, a liberdade para identificar o usuário e contar, e a proibição de guardá-lo em um cache; e a [seção 7.2](https://www.rfc-editor.org/rfc/rfc6585.html#section-7.2): responder `429` sob ataque também gasta recursos, e não é obrigatório.
8. [MITRE, CWE-209, *Generation of Error Message Containing Sensitive Information*](https://cwe.mitre.org/data/definitions/209.html): os stack traces, os caminhos e a estrutura das consultas em uma mensagem de erro como fraqueza.
9. [OWASP, *Error Handling Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html): o detalhe do erro é registrado do lado do servidor e ao usuário se responde uma mensagem genérica; e a [*Logging Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html): os tokens de acesso e os dados sensíveis não são registrados tal como estão.
10. [OWASP API Security Top 10, API4:2023 *Unrestricted Resource Consumption*](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption): limitar quantas vezes um cliente interage com a API em um tempo dado, e fixar limites de tempo de execução.
11. [OWASP, *Authentication Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), seção *Protect Against Automated Attacks*: o limite de tentativas contra a força bruta, contado por conta e não apenas por endereço de origem.
12. [IETF, *RateLimit header fields for HTTP*, `draft-ietf-httpapi-ratelimit-headers-11`](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/) (23 de maio de 2026): define `RateLimit-Policy` e `RateLimit`; é um rascunho, não uma RFC.
13. [Documentação da API REST do GitHub, *Rate limits for the REST API*](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api): `403` ou `429` ao exceder um limite, `retry-after`, `x-ratelimit-remaining` e `x-ratelimit-reset`.
14. [MDN, `AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static): o sinal aborta com uma `DOMException` de nome `TimeoutError`, diferente do `AbortError`; e [Node.js 24: `crypto.randomUUID()`](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptorandomuuidoptions): um UUID de versão 4 gerado com um gerador criptográfico.
15. [Manual do `curl`](https://curl.se/docs/manpage.html): `-m` (`--max-time`), `--http0.9` e os códigos de saída 1 (protocolo não suportado), 7 (não foi possível conectar), 18 (transferência incompleta), 28 (o tempo se esgotou) e 52 (o servidor não respondeu nada).

### Termos desta lição

| | |
|---|---|
| **gateway** | um servidor que, para responder, pede algo a outro servidor e responde com o que obteve; se o outro falha, responde `502` ou `504` |
| **dependência** | um serviço do qual outro precisa de uma resposta para fazer o seu trabalho |
| **referência** | um identificador aleatório que viaja no `500` e fica no log junto ao stack trace, para encontrar um erro sem revelar nada |
| **stack trace** (*pilha de chamadas*) | a lista de funções que estavam em execução quando ocorreu um erro, da mais recente à mais antiga |
| **log** | o que o servidor escreve para quem o opera; no `revisor`, o terminal dele |
| **limite de requisições** (*rate limiting*) | quantas requisições são aceitas em um tempo dado; ao ultrapassar, `429` |
| **janela fixa** | um limite que conta desde o início de uma janela e volta a zero quando a janela termina |
| **modo de manutenção** | um estado em que o servidor decide não atender e responde `503` com `Retry-After` |
| **`Retry-After`** | o cabeçalho que diz quanto esperar antes de pedir de novo: segundos ou uma data HTTP |

---

**Anterior:** [Lição 3 — O cliente errou (II): 409, 410, 412, 422 e 428](03-errores-del-cliente-estado.md) · **Próxima:** [Lição 5 — Problem Details (RFC 9457)](05-problem-details.md)

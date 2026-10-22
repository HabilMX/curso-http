# Lição 2 — O cliente errou (I): 400, 401, 403, 404, 405 e 415

São 02:10 de uma terça-feira e o `revisor` está há três semanas em produção, aberto a qualquer um que chegue à sua porta. Esta noite alguém da equipe da folha de pagamento escreveu um script para cadastrar seus serviços e o deixou rodando. O script envia os dados como formulário e não como JSON, e o `revisor` responde `400` a cada tentativa, com a mesma linha de sempre. O script só olha o código, e para ele um `400` é um `400`: não sabe ler a frase do corpo, então envia de novo a mesma coisa. Enquanto isso, em outro terminal, um estagiário descobre que com um `DELETE` qualquer um pode remover o serviço de pagamentos de outra equipe, porque o `revisor` não pergunta quem é ninguém. E em um terceiro, um script que ninguém reconhece percorre `/servicios/1`, `/servicios/2`, `/servicios/3`… e anota em qual a resposta é diferente. Às 02:40 ele já tem a lista completa do que a empresa monitora. Três problemas diferentes, e a API trata todos com dois códigos e um ponto de entrada que não existe.

Esta lição constrói esse ponto de entrada: sete perguntas, sempre na mesma ordem, e um código diferente para cada resposta.

**Tempo:** 90 min, ou 2 × 45 (a divisão está entre as seções 2.4 e 2.5)

**O que se constrói:** o ponto de entrada da API do `revisor`: rota, método, credencial, permissão, existência, tipo de conteúdo e leitura do corpo, com um código diferente para cada falha; e um pequeno programa que tenta adivinhar que serviços existem, para comprovar que o ponto de entrada não deixa

**O que se aprende:** as sete perguntas do ponto de entrada e por que elas seguem esta ordem: rota → método → credencial → permissão → existência → formato → leitura; `401` versus `403`; `404` versus `405`; `415` e `413` versus `400`; `WWW-Authenticate` e `Allow`, os dois cabeçalhos que a especificação torna obrigatórios; e quando um `404` esconde de propósito um recurso que existe, com o quadro de segurança sobre a **enumeração de recursos**

**Ponto de partida.** Da [Lição 1](01-exitos-redirecciones.md), com o `revisor` que cadastra, consulta, remove e verifica serviços, e que redireciona suas rotas antigas com `301` e `308`. Esse `revisor` já responde dois erros, um `400` e um `404`, mas a Lição 1 os usou como rede de segurança e prometeu explicá-los aqui. E ele tem três lacunas que esta lição fecha: não sabe quem está falando com ele, não distingue entre uma rota que não existe e um método que ela não admite, e aceita qualquer corpo que pareça JSON, venha com o tipo que vier.

**O que esta lição não faz.** Não ensina autenticação de verdade: as credenciais são quatro palavras escritas no código, e em uma API real elas vêm de um provedor de identidade, com tokens que vencem e são assinados (o [README](README.md) explica por que o curso deixa esse tema de fora). Não ensina o `422`: aqui, tudo o que não pode ser usado do corpo responde `400`, e a [Lição 3](03-errores-del-cliente-estado.md) separa o que não pode ser lido do que é lido mas não pode ser cumprido. E os corpos de erro continuam sendo uma linha de texto; a [Lição 5](05-problem-details.md) os troca por `application/problem+json`.

**Sobre as execuções.** O Linux Mint 22 é o sistema de referência do curso. As saídas desta lição foram obtidas em 21 de outubro de 2026 no macOS com Node 24.14.1 e curl 8.7.1, e nenhuma depende de algo próprio do macOS. Na execução de cada um vão mudar duas coisas: a data do cabeçalho `Date` e os oito dígitos finais de cada `ETag` (`"3-1-80925024"` na execução da lição), que o `revisor` sorteia toda vez que inicia; a seção 2.7.4 explica por quê, e quando uma requisição precisar da tag, copie a que saiu na resposta anterior. O `revisor` guarda tudo em memória: para obter o mesmo que a lição, inicie-o de novo antes de cada série de requisições, porque um cadastro ou uma remoção anterior muda as respostas. Os programas estão em [`programas/02-errores-del-cliente-peticion/`](../programas/02-errores-del-cliente-peticion), no repositório do curso: o `revisor` em `fig02_01/`, o enumerador em `fig02_02.ts`, as versões quebradas de «O erro a ser observado» em `defectos/`, e cada execução em seu arquivo `.salida.txt`. Todos passam no `tsc` em modo estrito, com o comando da seção 0.9 da Lição 0 mais a opção `--allowImportingTsExtensions`, necessária desde que o `revisor` tem vários arquivos que se importam entre si com sua extensão `.ts`.

## Ao terminar, será possível

- Recitar as sete perguntas do ponto de entrada em ordem e prever, para uma requisição dada, em qual ela para e que código responde.
- Distinguir com uma execução um `401` de um `403`, e um `404` de um `405`, e dizer que cabeçalho cada um exige.
- Escrever o cabeçalho `WWW-Authenticate` de um `401` e o cabeçalho `Allow` de um `405`, e citar a seção do RFC 9110 que os torna obrigatórios.
- Rejeitar um corpo com o tipo errado com `415` e `Accept`, e um que não pode ser lido com `400`.
- Demonstrar com um programa que a API não revela que serviços de outra equipe existem, e explicar que mudança no código bastaria para que ela revelasse.
- Explicar por que uma tabela de credenciais escrita como objeto JavaScript pode aceitar uma credencial que ninguém cadastrou.

## O porquê antes do como

Um erro do cliente é um código `4xx`, e a Lição 0 deu a pergunta que essa família responde: **quem errou? Quem pediu.** Mas «quem pediu errou» não ajuda muito quem pediu. O que ele precisa saber é **o que** fez errado, porque cada erro se corrige de um jeito:

| Se o problema é… | Quem pediu precisa… | Código |
|---|---|---|
| a rota não existe | conferir o endereço | `404` |
| a rota existe, mas não com esse método | usar outro método, dos que `Allow` informa | `405` |
| não disse quem é, ou disse errado | se autenticar | `401` |
| disse quem é, mas não tem direito | pedir permissão a alguém, ou desistir | `403` |
| o recurso não existe (para ele) | parar de procurá-lo | `404` |
| enviou o corpo em um formato que não é aceito | mudar o formato, para o que `Accept` informa | `415` |
| o corpo não pode ser lido | corrigir o corpo | `400` |

Cada linha é uma ação diferente, e quase sempre quem a executa é um programa, não uma pessoa. O script da cena do começo tentava de novo porque, para um programa, um `400` é um `400`: o corpo dizia «el cuerpo no es JSON», mas um programa não interpreta frases, e o código era o mesmo que para qualquer outro corpo inválido. Com um `415` e um `Accept: application/json`, o **código** teria dito que o problema era o formato e qual usar. (E o script também estava mal escrito: nenhum cliente bem feito repete sem mudanças uma requisição que recebeu um `4xx`, porque essa família diz que quem precisa mudar algo é quem pediu.) **Um código bem escolhido diz ao cliente o que fazer**, que é o segundo princípio do curso, e a [Lição 7](07-quien-lee-el-error.md) transforma esta tabela no programa que decide.

A tabela tem outra propriedade, menos visível e mais importante: **está em ordem**. Não é a mesma coisa perguntar primeiro «quem está pedindo?» e depois «existe?» ou o contrário. Se o `revisor` diz a um desconhecido «esse serviço não existe» antes de perguntar quem ele é, já contou algo. Se diz «esse serviço é de outra equipe», contou que ele existe. A ordem das perguntas decide o que aprende da API quem não deveria aprender nada, e por isso esta lição dedica tanto espaço a ela.

A lição tem quatro partes:

1. **O ponto de entrada** (2.1): as sete perguntas e por que elas seguem essa ordem.
2. **As quatro perguntas do ponto de entrada** (2.2 a 2.4): rota e método (`404`, `405`), credencial (`401`) e permissão (`403`).
3. **As três do handler** (2.5 e 2.6): existência (`404`, o que esconde) e formato e leitura (`415`, `400`), com o quadro de segurança.
4. **O `revisor` completo** (2.7): os arquivos e a execução de todos os casos.

## Os conceitos

### 2.1 O ponto de entrada: sete perguntas em ordem

#### 2.1.1 As perguntas

Comece por duas requisições já conhecidas da cena do começo: uma sem credencial e outra com um método que a rota não admite.

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: text/plain; charset=utf-8
Content-Length: 20
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

falta la credencial

$ curl -i -X PATCH http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, DELETE
Content-Type: text/plain; charset=utf-8
Content-Length: 35
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

PATCH no se admite en /servicios/1
```

Duas requisições, dois códigos diferentes: cada uma parou em uma pergunta diferente. Estas são as sete:

Quando uma requisição chega ao `revisor`, antes de qualquer coisa ser feita com ela, ela passa por uma série de perguntas. Cada uma tem uma resposta de sim ou não, e um «não» para a requisição nesse ponto com um código próprio:

| # | Pergunta | Se a resposta for «não» | Onde é respondida |
|---|---|---|---|
| 1 | A rota existe? | `404` | `rutas.ts` |
| 2 | A rota admite este método? | `405` + `Allow` | `rutas.ts` |
| 3 | Quem está pedindo? | `401` + `WWW-Authenticate` | `rutas.ts` |
| 4 | Quem pede pode fazer isto? | `403` | `rutas.ts` |
| 5 | O recurso existe, para quem pede? | `404` | o handler, em `servicios.ts` |
| 6 | O corpo vem em um formato aceito? | `415` + `Accept` | o handler |
| 7 | Dá para lê-lo? | `400`, ou `413` se passar do limite de tamanho | o handler |

Em uma linha: **rota → método → credencial → permissão → existência → formato → leitura**. São sete perguntas e sete passos. As quatro primeiras são respondidas pelo ponto de entrada, em `rutas.ts`, igual para todas as rotas. As três últimas dependem do que cada rota pede, e por isso quem as responde é o handler: só um `POST` traz corpo, e só uma rota com `{id}` aponta para um recurso que pode não existir. Uma requisição que passa pelas sete chega a fazer seu trabalho e responde um sucesso, dos vistos na Lição 1.

Antes da primeira pergunta há um passo já conhecido: as rotas herdadas. `/viejo/servicios` e `/api/servicios` são redirecionadas com `301` e `308` sem perguntar mais nada, porque um redirecionamento não entrega nenhum dado: só diz onde está a rota nova, e ali começam as perguntas. As Lições 3 e 4 acrescentam outras duas paradas nesse mesmo lugar, antes de tudo (a versão descontinuada da API e o modo de manutenção), e nenhuma muda a ordem das sete.

#### 2.1.2 Por que esta ordem

A ordem não é arbitrária, e não é a única possível. Ela sai de três regras, que convém ter em mente porque são as que vão ser usadas ao projetar um ponto de entrada próprio.

**Primeira regra: não dá para responder uma pergunta sem as anteriores.** Não dá para dizer se um método é admitido sem saber de que rota se fala; não dá para dizer se alguém pode fazer algo sem saber quem é; não dá para ler um corpo sem saber se ele está em um formato que se entende. Essa regra sozinha fixa boa parte da ordem: rota antes de método, credencial antes de permissão, formato antes de leitura.

**Segunda regra: quem não se identificou não aprende nada dos dados.** A credencial vem antes da existência. Se fosse o contrário, um desconhecido poderia pedir `/servicios/1`, `/servicios/2` e `/servicios/3` e saber, pela diferença entre um `404` e o que quer que venha depois, quais existem. Com a credencial primeiro, um desconhecido recebe `401` em todas, exista o serviço ou não. O mesmo vale para o corpo: se o `revisor` validasse o corpo antes de pedir a credencial, qualquer um poderia aprender, à força de `400`, que campos o cadastro espera e que valores admite, sem nunca ter se identificado. E além disso o servidor gastaria trabalho lendo corpos de quem não tem direito de enviá-los.

**Terceira regra: a permissão que depende do papel vem antes da existência.** Um leitor não pode apagar nada, exista ou não. Por isso o `403` chega antes da pergunta pelo recurso, e a resposta a «um leitor tenta apagar o serviço 99» é `403`, não `404`, mesmo que o 99 não exista. Assim o `403` não diz nada sobre o que existe: depende só da credencial e do método, não do identificador. Isso vai ser visto com uma execução na seção 2.4.

Resta uma decisão que não sai de nenhuma regra e que convém chamar pelo nome: **a rota e o método vêm antes da credencial**. O `revisor` responde `404` a uma rota que não existe e `405` a um método que não é admitido mesmo a quem não disse quem é. Isso conta a um desconhecido que rotas e que métodos a API tem. O `revisor` faz isso de propósito, porque essa informação já é pública: está em sua documentação, e na [Lição 8](08-contrato-verificable.md) vai estar em uma descrição OpenAPI que qualquer um pode ler. O que o ponto de entrada esconde são os **dados**, não a forma da API. Há APIs que decidem diferente e respondem `401` a tudo o que chega sem credencial, inclusive a uma rota que não existe; é uma decisão defensável quando a forma da API também é secreta. Nenhuma especificação obriga a uma ou a outra: **é princípio de design, não norma**, e o que é obrigatório é escrevê-lo e aplicá-lo igual em todas as rotas.

#### 2.1.3 O código do ponto de entrada

O ponto de entrada vive na função `atender` de `rutas.ts`, que na Lição 1 era um laço de seis linhas. Agora ela tem as quatro primeiras perguntas escritas uma após a outra, numeradas igual à tabela. O arquivo completo está na seção 2.7; aqui vai a função, para ler com a tabela ao lado:

```ts
export async function atender(peticion: IncomingMessage, respuesta: ServerResponse): Promise<void> {
  console.log(`${peticion.method} ${peticion.url}`);
  const url = new URL(peticion.url ?? "/", "http://revisor");
  if (redirigir(url.pathname, url.search, respuesta)) return;

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

  // 5, 6 y 7. ¿Existe el recurso? ¿En qué formato viene? ¿Se puede leer? Lo decide cada manejador.
  await metodo.manejador({ peticion, respuesta, parametros, credencial: identificacion.credencial });
}
```

Lê-se de cima para baixo, e cada bloco termina em um `return` se a resposta for «não». A primeira pergunta procura a rota por seu padrão, **sem olhar o método**: essa é a diferença em relação à Lição 1, em que a rota e o método eram procurados juntos e um método errado não encontrava nada e caía no `404`. Separá-los é o que permite responder `405`. A segunda pergunta procura o método dentro da rota encontrada, tratando `HEAD` como `GET`, e procura com `Object.hasOwn`, por um motivo que a seção 2.3.3 explica. A terceira e a quarta usam `autenticacion.ts`, que é novo. E no final, o ponto de entrada chama o handler e passa a ele a credencial, para que o handler possa responder às três perguntas que lhe cabem.

Repare em como a tabela de rotas é declarada: cada método diz se **lê** ou **escreve**.

```ts
type Manejador = (contexto: Contexto) => void | Promise<void>;
// Cada método dice qué función lo atiende y qué rol mínimo exige.
type Metodo = { manejador: Manejador; escribe: boolean };
type Ruta = { patron: RegExp; metodos: Record<string, Metodo> };

const lee = (manejador: Manejador): Metodo => ({ manejador, escribe: false });
const escribe = (manejador: Manejador): Metodo => ({ manejador, escribe: true });

const RUTAS: Ruta[] = [
  { patron: /^\/servicios$/, metodos: { GET: lee(listar), POST: escribe(darDeAlta) } },
  { patron: /^\/servicios\/(\d+)$/, metodos: { GET: lee(consultar), DELETE: escribe(retirar) } },
  { patron: /^\/servicios\/(\d+)\/revisiones$/, metodos: { POST: escribe(pedirRevision) } },
  { patron: /^\/revisiones\/(\d+)$/, metodos: { GET: lee(consultarRevision) } },
];
```

`lee` e `escribe` são duas funções de uma linha que envolvem o handler com essa marca. A marca é o que a pergunta 4 usa: um leitor pode usar os métodos que leem e não os que escrevem. É um modelo de permissões deliberadamente pequeno, de três papéis, mas tem a propriedade que importa: **a permissão é declarada junto da rota**, na mesma linha, e não escondida dentro de cada handler, onde é fácil esquecê-la em um.

### 2.2 Rota e método: `404` e `405`

#### 2.2.1 Uma rota que não existe

A primeira pergunta é a mais simples. Se ninguém na tabela reconhece a rota, a resposta é `404 Not Found`. O RFC 9110 o define na [seção 15.5.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.5): o servidor não encontrou uma representação atual do recurso pedido, **ou não está disposto a revelar que ele existe**. Guarde a segunda metade dessa frase; ela vai ser necessária na seção 2.5.

```text
$ curl -i http://127.0.0.1:18080/servicioss -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 19
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe esa ruta
```

`/servicioss`, com um «s» a mais, não está na tabela, e o ponto de entrada para na pergunta 1. Repare que a requisição trazia uma credencial válida, e isso não importou: o ponto de entrada ainda não chegou a olhá-la.

#### 2.2.2 Um método que a rota não admite

A segunda pergunta é a que o `revisor` da Lição 1 não sabia responder. `/servicios/1` existe, mas só admite `GET` (para consultar) e `DELETE` (para remover). Enviando um `PATCH`:

```text
$ curl -i -X PATCH http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, DELETE
Content-Type: text/plain; charset=utf-8
Content-Length: 35
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

PATCH no se admite en /servicios/1
```

`405 Method Not Allowed`. O RFC 9110 o define na [seção 15.5.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.6): o servidor conhece o método, mas o recurso não o admite. E na mesma seção coloca o primeiro dos dois cabeçalhos obrigatórios desta lição: o servidor **deve** (*MUST*) enviar em um `405` um cabeçalho `Allow` com a lista de métodos que o recurso admite. A [seção 10.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.1), que define `Allow`, repete isso e acrescenta que ele pode ser enviado em qualquer outra resposta, mas que em um `405` é obrigatório.

Por que obrigatório? Porque sem ele o `405` não diz o que fazer. «Esse método não» deixa o cliente testando métodos às cegas; «esse método não, estes sim» dá a correção completa. `Allow: GET, HEAD, DELETE` diz exatamente o que se pode fazer com `/servicios/1`. A função `permitidos` de `rutas.ts` o monta com os métodos da tabela, e acrescenta `HEAD` logo depois de `GET`, porque toda rota que admite `GET` admite também `HEAD` (o Node não envia o corpo; isso apareceu na Lição 0).

Este é o erro que o `revisor` da Lição 1 cometia de propósito: a esse mesmo `PATCH` ele respondia `404 no existe esa ruta`. Era mentira, e uma mentira que custa caro: um cliente que recebe `404` conclui que o endereço está errado e começa a procurar outro, quando o endereço estava certo e o que precisava mudar era o método.

#### 2.2.3 `405` versus `501`

Há um código vizinho que convém distinguir: `501 Not Implemented`. A [seção 9.1 do RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.1) traça a fronteira: se o servidor **não reconhece ou não implementa** o método em lugar nenhum, deveria responder `501`; se o reconhece e o implementa, mas **não para este recurso**, deveria responder `405`. O `revisor` responde `405` a qualquer método **que o Node conhece** e que a rota não admite, como `PATCH` ou `PUT`. A um método inventado, como `BORRAR`, nem chega: o analisador HTTP do Node o rejeita antes com um `400 Bad Request` sem corpo (isso vai aparecer com `-X constructor` na seção 2.3.3). Segundo o RFC, ali caberia um `501`, mas essa decisão é tomada pelo Node, não pelo `revisor`. O `501` não é protagonista deste curso: o laboratório o produz em `/codigo/501` para quem quiser vê-lo.

Uma sutileza que vale a pena comprovar com as próprias mãos: a rota de verificações, `/servicios/{id}/revisiones`, só admite `POST`. O que acontece com um `HEAD` nela?

```text
$ curl -i -I http://127.0.0.1:18080/servicios/1/revisiones
HTTP/1.1 405 Method Not Allowed
Allow: POST
Content-Type: text/plain; charset=utf-8
Content-Length: 45
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

`405` com `Allow: POST`. `HEAD` só é admitido onde `GET` é admitido, e esta rota não tem `GET`. E a requisição não trazia credencial: o ponto de entrada parou na pergunta 2 sem chegar à 3, como a ordem diz.

### 2.3 Quem está pedindo?: `401` e `WWW-Authenticate`

#### 2.3.1 Credencial ausente, credencial inválida

A terceira pergunta precisa que o cliente diga quem é. Em HTTP isso é feito com o cabeçalho `Authorization`, e o `revisor` usa o esquema mais comum em APIs: **`Bearer`**, definido no [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html). A requisição envia `Authorization: Bearer <credencial>`, e quem tem a credencial (quem a «porta», daí o nome) é quem diz ser. Por isso mesmo, em uma API real uma credencial `Bearer` só viaja cifrada, por `https`: o RFC 6750, em sua [seção 5.3](https://www.rfc-editor.org/rfc/rfc6750.html#section-5.3), exige que os clientes usem sempre TLS, porque quem a ler no caminho pode usá-la. O curso usa `http` só porque tudo acontece dentro da máquina local, em `127.0.0.1`, e nada sai para a rede. As credenciais do curso são quatro, escritas em `autenticacion.ts`:

| Credencial | Equipe | Papel |
|---|---|---|
| `lectura-a` | a | leitor |
| `escritura-a` | a | escritor |
| `escritura-b` | b | escritor |
| `admin` | todas | admin |

Sem credencial:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: text/plain; charset=utf-8
Content-Length: 20
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

falta la credencial
```

Com uma credencial que não existe:

```text
$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer inventada'
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor", error="invalid_token"
Content-Type: text/plain; charset=utf-8
Content-Length: 28
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

la credencial no es válida
```

As duas são `401 Unauthorized`, e as duas trazem o segundo cabeçalho obrigatório da lição. A [seção 15.5.2 do RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.2) define o `401` assim: a requisição não foi aplicada porque lhe faltam credenciais de autenticação válidas para o recurso. E na frase seguinte: o servidor que gera um `401` **deve** enviar um cabeçalho `WWW-Authenticate` com pelo menos um **desafio** (*challenge*) que se aplique ao recurso. O desafio diz ao cliente **como** se autenticar: com que esquema (`Bearer`) e em que domínio (`realm="revisor"`, um nome para o espaço protegido). Um `401` sem `WWW-Authenticate` é como uma placa de «identifique-se» que não diz com quê.

A diferença entre as duas respostas está no desafio. Quando não veio credencial, o desafio é só `Bearer realm="revisor"`. Quando veio uma que não serve, acrescenta `error="invalid_token"`. Essa regra não é do `revisor`, é do RFC 6750, em sua [seção 3.1](https://www.rfc-editor.org/rfc/rfc6750.html#section-3.1): `invalid_token` é o código para uma credencial vencida, revogada, malformada ou inválida por qualquer outro motivo, e vai com um `401`; mas se a requisição **não traz nenhuma informação de autenticação** (porque o cliente não sabia que era necessário, ou porque usou **um método de autenticação que o servidor não admite**), o servidor **não deveria** incluir no desafio um código de erro nem outra informação de erro (os atributos `error`, `error_description` e `error_uri`). O corpo da resposta fica fora dessa regra, e o `revisor` o usa para explicar em espanhol o que aconteceu. A distinção serve ao cliente: «não enviou nada» se corrige enviando a credencial; «enviou uma que não serve» se corrige conseguindo outra.

Essa última frase do RFC tem um caso que convém ver: um cliente que envia seu usuário e senha com o esquema `Basic`, o da janelinha de usuário e senha que o navegador abre (definido no [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617.html)). Ele não enviou uma credencial `Bearer` ruim: não enviou nenhuma `Bearer`. O `revisor` responde o desafio **sem** código de erro, e diz isso no corpo:

```text
$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Basic bGVjdHVyYS1hOg=='
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: text/plain; charset=utf-8
Content-Length: 33
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

solo se admite el esquema Bearer
```

E mais um detalhe, da [seção 11.1 do RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-11.1): o nome do esquema de autenticação **não distingue maiúsculas**. `Bearer`, `bearer` e `BEARER` são o mesmo esquema, e um servidor que só aceita a primeira rejeita clientes que cumprem a especificação:

```text
$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 279
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}
```

A lista já traz o serviço 4, cadastrado antes na mesma execução (a seção 2.7 a mostra completa). O que distingue maiúsculas é a própria credencial: `Bearer Lectura-a` é uma credencial que não existe.

Uma nota sobre o nome, porque confunde todo mundo uma vez: o `401` se chama *Unauthorized*, «não autorizado», mas o que ele diz é **não autenticado**: não se sabe quem pede. «Não autorizado» no sentido de «sabe-se quem pede e ele não tem direito» é o `403`, o da seção seguinte. O nome é uma herança das primeiras versões do HTTP e já não pode ser mudado; o significado está na especificação, não na frase.

#### 2.3.2 `autenticacion.ts`

```ts
// fig02_01/autenticacion.ts — quién eres (la credencial) y qué puedes hacer (el rol).
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

O arquivo tem quatro peças. A **tabela** de credenciais, que em uma API real não existiria: as credenciais são emitidas por um provedor de identidade e o servidor as verifica, por exemplo comprovando a assinatura de um token. A função **`identificar`**, que lê o cabeçalho `Authorization` e retorna um de quatro resultados: não veio nenhuma, veio com outro esquema, veio uma `Bearer` inválida ou veio uma válida, com sua credencial. Primeiro ela separa o nome do esquema (o que vem antes do primeiro espaço) e o compara em minúsculas; se não for `bearer`, nem procura a credencial. A função **`motivo`** escreve a frase do corpo do `401` para cada caso, e a função **`reto`** monta o valor de `WWW-Authenticate`: o código `invalid_token` só quando chegou uma credencial `Bearer` que não serve. O tipo `Identificacion` é uma união de quatro casos, e o ponto de entrada pergunta por `tipo` antes de usar `credencial`; o TypeScript não deixa usá-la nos outros três.

#### 2.3.3 Por que a tabela é um `Map`

Há um detalhe na tabela de credenciais que parece de estilo e é de segurança: é um `Map`, e é consultada com `CREDENCIALES.get(token)`. A forma que ocorre primeiro a quase todo mundo é um objeto, `{ "lectura-a": {…}, "admin": {…} }`, consultado com `CREDENCIALES[token]`. Parece igualmente bom, o TypeScript não reclama, e as quatro credenciais funcionam igual. Mas tem uma brecha.

Em JavaScript, um objeto escrito com chaves **herda** propriedades de outro objeto, seu **protótipo**, `Object.prototype`. Por isso todo objeto responde a `toString`, a `hasOwnProperty` ou a `constructor`, embora ninguém os tenha escrito nele. E `CREDENCIALES[token]` não distingue o que foi escrito no objeto do que ele herdou: se o token for `constructor`, a busca encontra algo, a função `Object`, e esse algo não é `undefined`. Para `identificar`, que só pergunta se encontrou algo, **`Bearer constructor` seria uma credencial válida**. A seção «O erro a ser observado» provoca isso com uma execução, e o que o `revisor` responde nesse caso não é o que se esperaria.

`Map.get` não tem esse problema: retorna só o que foi guardado com `set` (ou na lista inicial), e para qualquer outra chave, `undefined`. A outra defesa correta é um objeto sem protótipo, criado com `Object.create(null)`, consultado com `Object.hasOwn(objeto, token)`, que só olha as propriedades próprias. As duas fecham a brecha; o `Map` além disso deixa claro, a quem lê o código, que aquilo é uma tabela de busca e não um objeto com propriedades.

O caso ensina algo que vai além do JavaScript: **a pergunta «quem está pedindo?» só é respondida com «sim» quando se encontrou exatamente o que se procurava**. Qualquer caminho do código que possa retornar «encontrei algo» por acidente (uma propriedade herdada, uma comparação que aceita uma string vazia, uma busca que não distingue maiúsculas onde deveria) é uma credencial que ninguém emitiu. Em uma API real, esse acidente vive na verificação da assinatura de um token, na comparação de uma chave ou na consulta a um banco de dados, e a regra é a mesma.

O mesmo cuidado aparece em outro lugar do ponto de entrada. A tabela de métodos de cada rota também é um objeto (`{ GET: …, DELETE: … }`), e o método é escrito pelo cliente. Por isso `atender` não a consulta com `ruta.metodos[nombreMetodo]` puro, e sim com `Object.hasOwn(ruta.metodos, nombreMetodo)`, que só olha os métodos que foram escritos na tabela. Chegaria um método chamado `constructor`? Na prática, nem chega ao ponto de entrada:

```text
$ curl -i -X constructor http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 400 Bad Request
Connection: close
```

O analisador HTTP do Node só aceita os métodos que conhece, e a qualquer outro responde `400` por conta própria, sem corpo e fechando a conexão, antes de chamar `atender`; por isso o terminal do `revisor` não o anota. O ponto de entrada não depende desse filtro: uma tabela que decide algo com uma informação enviada pelo cliente é escrita de forma a só encontrar o que foi guardado nela, mesmo que outra peça filtre antes, porque a outra peça pode mudar amanhã.

### 2.4 Pode fazer isto?: `403`

#### 2.4.1 Um leitor que tenta escrever

Com a credencial verificada, a quarta pergunta é se essa credencial pode fazer o que pede. A função `puede` de `rutas.ts` resolve isso em uma linha: se o método lê, qualquer um pode; se escreve, só um escritor ou um administrador.

```text
$ curl -i -X DELETE http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu credencial solo puede leer; para escribir pide una con rol de escritor
```

`403 Forbidden`. A [seção 15.5.4 do RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.4) o define assim: o servidor entendeu a requisição, mas se recusa a cumpri-la. E acrescenta o que o separa do `401`: se a requisição trazia credenciais, o servidor as considera **insuficientes** para dar acesso, e o cliente **não deveria** repetir a requisição com as mesmas credenciais; pode repeti-la com outras. O `403` não exige nenhum cabeçalho, diferentemente do `401` e do `405`. (Com tokens OAuth, o RFC 6750 permite acrescentar ao `403` um desafio com `error="insufficient_scope"` para dizer que faltam permissões ao token; o `revisor` não usa escopos e não o envia.) Ele pode explicar no corpo por que se recusou, e o `revisor` faz isso: `tu credencial solo puede leer; para escribir pide una con rol de escritor`.

Repare no que esse texto **não** diz: ele não repete a credencial. Seria tentador escrever «a credencial `lectura-a` só pode ler», que soa mais preciso. Mas no `revisor`, o nome de uma credencial é a própria credencial: `lectura-a` é ao mesmo tempo quem pede e a chave para entrar. Repeti-la no corpo é escrever um segredo em uma resposta, e as respostas de erro acabam em lugares que ninguém vigia: o log de um balanceador, o cache de um intermediário, o relatório de erros do cliente ou a captura de tela que alguém cola em um chat para pedir ajuda. Em uma API real acontece o mesmo com um token: a mensagem de erro diz o que falta ao cliente (um papel de escritor) e nunca devolve o que o cliente enviou para se identificar. O cliente já sabe disso; quem não deve saber é tudo o que está no meio.

A pergunta que decide entre os dois códigos é curta, e convém sabê-la de cor: **mudaria algo se ele se identificasse de novo?** Se o servidor não sabe quem pede, ou o que recebeu não serve, identificar-se resolve o problema: `401`. Se sabe quem pede e o que é pedido não lhe cabe, identificar-se de novo com a mesma coisa não muda nada: `403`. Um cliente que recebe `401` pode pedir uma credencial nova e tentar de novo; um que recebe `403` não deve tentar de novo com a mesma, e o sensato é desistir ou pedir permissão a uma pessoa.

#### 2.4.2 O `403` não depende do identificador

Aqui aparece a terceira regra da ordem. O que acontece se o leitor tenta apagar um serviço que não existe?

```text
$ curl -i -X DELETE http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu credencial solo puede leer; para escribir pide una con rol de escritor
```

`403`, igual ao serviço 1. O ponto de entrada respondeu à pergunta 4 antes de chegar à 5, então não sabe, nem se importa, se o serviço 99 existe. Para um leitor, **todo** `DELETE` é um `403`, com qualquer identificador. É exatamente o que se quer: o `403` deste ponto de entrada fala da credencial e do método, e não deixa ver nada dos dados. Se a ordem fosse a contrária, existência antes de permissão, o leitor receberia `403` nos serviços que existem e `404` nos que não, e teria um mapa completo do que existe sem ter conseguido apagar nada. É o mesmo vazamento que o quadro de segurança da seção 2.5 descreve para o `404`, por outro caminho.

### 2.5 Existe, para quem pede?: o `404` que esconde

#### 2.5.1 Cada serviço é de uma equipe

A partir desta lição, cada serviço pertence a uma equipe. Os três iniciais já tinham isso escrito em `almacen.ts`: `catalogo` e `pagos` são da equipe a, `nomina` é da equipe b. A Lição 1 ignorava isso; agora o `revisor` usa isso em três lugares. Ao **listar**, cada credencial vê só os serviços de sua equipe:

```text
$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 189
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000}]}
```

`lectura-a` vê os serviços 1 e 2, e não vê o 3. Ao **cadastrar**, o serviço novo fica na equipe de quem o criou. E ao **consultar, remover ou pedir uma verificação** de um serviço, a pergunta 5 não é só «existe?», e sim **«existe para quem pede?»**.

#### 2.5.2 O mesmo `404` para o alheio e para o inexistente

O que o `revisor` deve responder quando `lectura-a` pede o serviço 3, que existe mas é da equipe b? Há duas respostas possíveis, e as duas são permitidas pela especificação. A primeira é `403`: «existe, e não lhe cabe». A segunda é `404`: «para quem pede, não existe». O RFC 9110 contempla as duas em um único parágrafo da [seção 15.5.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.4): um servidor de origem que queira **«esconder»** a existência de um recurso proibido **pode**, em vez do `403`, responder `404`. E a definição do `404`, vista em 2.2.1, já trazia isso: não encontrou o recurso **ou não está disposto a revelar que ele existe**.

O `revisor` escolhe a segunda. Veja as duas respostas lado a lado, primeiro o serviço 3, que existe, e depois o 99, que não existe:

```text
$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 3

$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 25
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 99
```

As duas são iguais exceto pelo número do serviço, que é o pedido. O mesmo código, os mesmos cabeçalhos, o mesmo corpo, o mesmo tamanho menos um byte pelo dígito a mais. Com essas duas respostas não há como saber qual dos dois serviços existe. E o dono o vê:

```text
$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b'
HTTP/1.1 200 OK
ETag: "3-1-a06a8084"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

A decisão está em uma função de quatro linhas de `servicios.ts`, que todos os handlers usam em vez de procurar o serviço diretamente:

```ts
// Un servicio de otro equipo se trata como si no existiera: el 404 esconde a propósito.
function visible(id: string, credencial: Credencial): Servicio | undefined {
  const servicio = buscarServicio(Number(id));
  if (servicio === undefined) return undefined;
  return credencial.equipo === "*" || servicio.equipo === credencial.equipo ? servicio : undefined;
}

function noExiste(respuesta: ServerResponse, id: string): void {
  fallar(respuesta, 404, `no existe el servicio ${id}`);
}
```

`visible` retorna o serviço só se ele for da equipe da credencial (ou se a credencial for de administrador, cuja equipe é `*`), e `undefined` em qualquer outro caso. Para o handler, «não existe» e «é de outro» são o mesmo `undefined`, e por isso produzem o mesmo `404`, com o mesmo texto, escrito em um único lugar: `noExiste`. **O conteúdo da resposta não pode diferir, porque o código não tem como distingui-los.** Essa é a forma segura de escrever isso: não dois ramos que se tenta manter iguais, e sim um único ramo. O que isso garante é a igualdade da resposta (código, cabeçalhos e texto), não a do tempo que ela leva: em um armazenamento em memória como este a diferença não dá para medir, mas com um banco de dados real, buscar um registro e verificar de quem ele é pode levar um tempo diferente de descartar um inexistente, e quem mede microssegundos poderia perceber. É um canal lateral (*side channel*, informação que vaza por algo que não é o conteúdo), e ele é vigiado à parte, por exemplo consultando por identificador e equipe em uma única busca.

> **Quadro de segurança: o `404` que esconde e a enumeração de recursos**
>
> **O que é a enumeração.** É descobrir que recursos existem testando identificadores um após o outro e comparando as respostas. Não é preciso ler nenhum dado: basta a API responder **diferente** ao que existe e ao que não existe. Se `/servicios/3` responde `403` e `/servicios/99` responde `404`, quem testa do 1 ao 1000 sai com a lista dos serviços que existem, quantos são e, se os identificadores forem consecutivos, quantos são criados por semana. O guia de testes de segurança da OWASP descreve essa técnica em seu teste [WSTG-IDNT-04](https://github.com/OWASP/wstg/blob/master/document/4-Web_Application_Security_Testing/03-Identity_Management/04-Account_Enumeration_and_Guessable_User_Account.md), e seu exemplo é exatamente este: `/account1` responde `403`, `/account2` responde `404`, e quem testa conclui que a primeira conta existe e a segunda não.
>
> **Por que importa mesmo sem ler nada.** Saber o que existe é o primeiro passo de quase qualquer ataque: com a lista se procuram os recursos que valem a pena, testam-se credenciais roubadas só onde há algo, e descobrem-se nomes internos que não deviam vazar. E a diferença não precisa estar no código: um corpo diferente («não existe» versus «é de outra equipe»), um tamanho diferente ou um cabeçalho a mais bastam.
>
> **A defesa do `revisor`.** O alheio e o inexistente respondem de forma **idêntica**: o mesmo código, o mesmo corpo, saídos da mesma função. O RFC 9110 permite isso expressamente (seção 15.5.4), e é o que fazem APIs que operam em grande escala: a [documentação da API do GitHub](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api) explica que responde `404` e não `403` a um recurso privado, para não confirmar que ele existe. E a ordem do ponto de entrada fecha os outros dois caminhos: um desconhecido recebe `401` em todos os identificadores (pergunta 3), e um leitor que tenta escrever recebe `403` em todos (pergunta 4), existam ou não.
>
> **O que o `404` não faz.** Esconder a existência não é o mesmo que proteger o recurso. O que impede a equipe a de ler o serviço da equipe b não é o `404`, é `visible` comparar a equipe **em cada acesso**. Esquecer essa comparação em um handler é o erro número um da lista de riscos de APIs da OWASP, [API1:2023, *Broken Object Level Authorization*](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization), e a defesa que ela propõe é essa: verificar, em cada função que recebe um identificador do cliente, que quem pede pode fazer isso com esse registro. O mesmo guia sugere também usar identificadores aleatórios, difíceis de adivinhar, em vez de consecutivos; o `revisor` usa consecutivos para que o curso seja legível, e por isso o `404` uniforme é o que o protege. Com identificadores aleatórios, a enumeração seria muito mais cara, mas a resposta uniforme continuaria sendo necessária.
>
> **Quando isso é escrito como política.** Esconder tem um custo: o dono legítimo que erra a credencial recebe «não existe» e pode perder um tempo procurando um erro de endereço. Por isso a decisão é escrita e aplicada igual em toda a API: no `revisor`, **todo recurso de outra equipe responde `404`, em toda rota e todo método**. O que não vale é esconder em algumas rotas e não em outras; a primeira rota que responder diferente desfaz o que as demais escondem.

#### 2.5.3 Comprovar com um programa

Uma afirmação de segurança se comprova atacando, não lendo o código. Este programa faz o que faria quem quer enumerar: percorre os identificadores de 1 a 6 com uma credencial, anota o que o `revisor` responde a cada um e tira suas conclusões. Salve-o como `~/curso-http/fig02_02.ts`:

```ts
// fig02_02.ts
// El enumerador: prueba identificadores uno tras otro y agrupa los que recibieron la misma respuesta.
// Uso: node fig02_02.ts <credencial>
const credencial = process.argv[2] ?? "lectura-a";
const grupos = new Map<string, number[]>(); // respuesta → identificadores que la recibieron

for (let id = 1; id <= 6; id++) {
  const respuesta = await fetch(`http://127.0.0.1:18080/servicios/${id}`, {
    headers: { Authorization: `Bearer ${credencial}` },
  });
  const cuerpo = (await respuesta.text()).trim();
  // Un éxito trae los datos del servicio; un error trae un texto, y en él se borra el número pedido,
  // para que dos errores que solo difieren en el id cuenten como la misma respuesta.
  const huella = respuesta.ok
    ? `${respuesta.status} con datos`
    : `${respuesta.status} ${cuerpo.replaceAll(String(id), "N")}`;
  console.log(`servicio ${id}: ${respuesta.status} ${cuerpo}`);
  grupos.set(huella, [...(grupos.get(huella) ?? []), id]);
}

console.log(`\nrespuestas distintas: ${grupos.size}`);
for (const [huella, ids] of grupos) console.log(`  ${ids.join(", ").padEnd(18)} → ${huella}`);
if (grupos.size > 2) console.log("más de dos respuestas: lo que no es tuyo ya no se ve todo igual");
```

O programa não sabe nada do `revisor` por dentro: vê só o que qualquer um veria de fora. Para cada identificador, guarda uma **impressão** da resposta: o código e, se for um erro, o corpo com o número pedido apagado, para que «no existe el servicio 3» e «no existe el servicio 4» contem como a mesma resposta. No final, agrupa os identificadores por impressão. Se o alheio e o inexistente recebem a mesma resposta, tem de haver exatamente dois grupos: os próprios, com dados, e todos os outros. Um terceiro grupo significa que algo distingue o alheio do inexistente, e o programa avisa. É o mesmo raciocínio que uma pessoa faria com uma planilha, só que em um segundo. Comparar o corpo, e não só o código, importa: um enumerador de verdade olha tudo o que muda, e um `404` com dois textos diferentes denuncia tanto quanto um `403` versus um `404`.

Com o laboratório e o `revisor` de 2.7 rodando, recém-iniciados:

```text
$ node fig02_02.ts lectura-a
servicio 1: 200 {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
servicio 2: 200 {"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000}
servicio 3: 404 no existe el servicio 3
servicio 4: 404 no existe el servicio 4
servicio 5: 404 no existe el servicio 5
servicio 6: 404 no existe el servicio 6

respuestas distintas: 2
  1, 2               → 200 con datos
  3, 4, 5, 6         → 404 no existe el servicio N
```

Dois grupos. `lectura-a` sabe que existem o 1 e o 2, que são seus, e não sabe nada do 3: para ele, o 3 é tão inexistente quanto o 6, que de fato não existe. Em «O erro a ser observado», quatro linhas de `servicios.ts` vão ser mudadas e o terceiro grupo vai aparecer.

#### 2.5.4 As verificações também são de uma equipe

A pergunta «existe para quem pede?» não se limita aos serviços. Uma verificação pertence ao serviço que verificou, e portanto à sua equipe. `consultarRevision` responde `404` se a verificação não existe **ou** se seu serviço não é visível para a credencial:

```ts
export function consultarRevision({ respuesta, parametros, credencial }: Contexto): void {
  const revision = buscarRevision(Number(parametros[0]));
  if (revision === undefined || visible(String(revision.servicio), credencial) === undefined) {
    fallar(respuesta, 404, `no existe la revisión ${parametros[0]}`);
    return;
  }
  const cabeceras: Cabeceras = revision.estado === "pendiente" ? { "Retry-After": "1" } : {};
  enviarJson(respuesta, 200, representarRevision(revision), cabeceras);
}
```

É o mesmo padrão com outro recurso, e convém notá-lo porque é o lugar onde mais se esquece: o recurso principal é protegido com cuidado, e o recurso «filho», a que se chega com outro identificador, fica aberto. Se `consultarRevision` procurasse a verificação sem perguntar de quem é seu serviço, qualquer um da equipe b poderia ler os resultados das verificações da equipe a percorrendo `/revisiones/1`, `/revisiones/2`…, mesmo sem conseguir ver os serviços.

### 2.6 O corpo: `415` e `400`

#### 2.6.1 O formato antes da leitura

As duas últimas perguntas só são feitas quando a requisição traz um corpo, e no `revisor` isso é o cadastro, `POST /servicios`. Primeiro, **vem em um formato aceito?** O cliente diz o formato de seu corpo com o cabeçalho `Content-Type`, e o `revisor` só aceita `application/json`. Depois, **dá para lê-lo?**: mesmo dizendo que é JSON, pode não ser.

As duas perguntas são respondidas pela função `leerJson` de `servicios.ts`, que é nova:

```ts
// Lee el cuerpo como JSON. Si no puede, ya respondió 415 o 400 y devuelve undefined.
async function leerJson(peticion: IncomingMessage, respuesta: ServerResponse): Promise<Record<string, unknown> | undefined> {
  const tipo = (peticion.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  if (tipo !== "application/json") {
    fallar(respuesta, 415, `el cuerpo debe ser application/json, no ${tipo === "" ? "(sin tipo)" : tipo}`, {
      Accept: "application/json",
    });
    return undefined;
  }
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
```

A primeira parte compara o `Content-Type` com `application/json`. Antes de comparar, fica com o que está antes do primeiro `;` e o passa para minúsculas, porque `application/json; charset=utf-8` e `Application/JSON` são o mesmo tipo: a [seção 8.3.1 do RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.1) diz que o tipo e o subtipo não distinguem maiúsculas, e que o que vem depois do `;` são parâmetros. Se o tipo não for JSON, responde `415`. A segunda parte tenta ler o JSON, e além disso exige que ele seja um **objeto**: um número, um texto ou uma lista são JSON válido, mas não são um serviço. Se qualquer uma das duas coisas falhar, responde `400`, com o mesmo texto para as duas: «el cuerpo no es un objeto JSON» cobre tanto um JSON cortado quanto um que se lê bem mas não é um objeto. Antes de ler, além disso, `leerCuerpo` verifica o tamanho, e se o corpo for grande demais `leerJson` responde `413`; a seção 2.6.4 explica isso.

#### 2.6.2 `415`: o formato não é o aceito

`curl -d` é a forma mais curta de enviar um corpo, e tem uma armadilha que vale a pena ver uma vez. Sem informar o tipo, ele envia `application/x-www-form-urlencoded`, o formato dos formulários web, como diz a [documentação da opção `-d`](https://curl.se/docs/manpage.html#-d):

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -d 'nombre=inventario'
HTTP/1.1 415 Unsupported Media Type
Accept: application/json
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo debe ser application/json, no application/x-www-form-urlencoded
```

`415 Unsupported Media Type`. A [seção 15.5.16 do RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.16) o define: o servidor se recusa a atender a requisição porque o conteúdo vem em um formato que este método não admite neste recurso. E acrescenta que cabeçalho ajuda o cliente: se o problema é o tipo de mídia, o cabeçalho `Accept` **na resposta** pode dizer que tipos teriam sido aceitos. Aqui a especificação diz **pode**, não **deve**: diferentemente de `Allow` no `405` e de `WWW-Authenticate` no `401`, `Accept` em um `415` é recomendável, não obrigatório. O `revisor` o envia sempre, porque ele transforma o erro em uma instrução: «não aceito formulários; aceito `application/json`». E uma pergunta razoável: o que acontece com o corpo que o `revisor` não leu? Foi medido: um `POST` de 8 MiB com `Content-Type: text/plain` recebeu o `415`, e a requisição seguinte pela mesma conexão recebeu seu `200` normal; o Node descarta por conta própria o corpo que ninguém leu quando a resposta termina, então aqui não é preciso `Connection: close`, ao contrário do `413`, em que o objetivo é parar de receber.

`Accept` em uma resposta é menos comum do que em uma requisição, e convém não confundi-los. Em uma requisição, `Accept` diz que formatos o cliente quer **receber**, e se o servidor não puder produzir nenhum, o código é outro, `406 Not Acceptable`, que não é protagonista deste curso. Na resposta a um `415`, `Accept` diz que formatos o servidor aceita **receber**. Mesmo nome, direção contrária.

Com um tipo explícito que também não é JSON, o resultado é o mesmo, e o corpo diz qual chegou:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -d 'inventario'
HTTP/1.1 415 Unsupported Media Type
Accept: application/json
Content-Type: text/plain; charset=utf-8
Content-Length: 51
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo debe ser application/json, no text/plain
```

#### 2.6.3 `400`: diz ser JSON e não pode ser lido

Agora o tipo é o correto, mas o JSON está cortado ao meio:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre": "inventario",'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 31
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo no es un objeto JSON
```

`400 Bad Request`. É o código mais geral da família, e a [seção 15.5.1 do RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.1) o define com essa amplitude: o servidor não pode ou não quer processar a requisição por algo que percebe como um erro do cliente, e dá como exemplos uma sintaxe malformada ou uma mensagem mal delimitada. Um JSON cortado é sintaxe malformada.

Por que `415` vem antes de `400`, e não o contrário? Pela primeira regra da ordem: não dá para dizer se algo pode ser lido sem saber em que formato está. Se o `revisor` tentasse ler como JSON um corpo que diz ser um formulário, o erro que veria seria «não é JSON», e responderia `400`; o cliente concluiria que seu JSON está errado, quando o que está errado é o cabeçalho. A ordem faz com que cada falha tenha seu código.

#### 2.6.4 `413`: o corpo é grande demais

O formato não é a única coisa que pode ser rejeitada antes de entender um corpo: o **tamanho** também. Para ler um corpo, o `revisor` o guarda em memória, e um servidor que guarda em memória tudo o que lhe enviam entrega a qualquer um a chave para enchê-la. Primeiro o vermelho. Em uma cópia do `revisor` (a versão completa está em `defectos/sin-tope/respuestas.ts`), troque o limite de `respuestas.ts` por infinito:

```ts
export const TOPE_CUERPO = Infinity;
```

Inicie o laboratório e a cópia e, em outro terminal, guarde o número de processo do `revisor` em uma variável: `REV=$(pgrep -f 'node servidor.ts')`. Com ele, `ps -o rss= -p $REV` diz quanta memória o processo ocupa, em kilobytes. Meça, envie um cadastro de 50 MB de letras `a` e meça de novo:

```text
$ ps -o rss= -p $REV
 93056

$ head -c 52428800 /dev/zero | tr '\0' 'a' | curl -sS -o /dev/null -w '%{http_code} en %{time_total} s\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' --data-binary @-
400 en 0.041348 s

$ ps -o rss= -p $REV
224064

$ curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
200
```

A memória do processo passou de uns 93 MB para uns 224 MB por **uma** requisição, e o `revisor` a leu inteira para acabar respondendo `400`, porque 50 MB de letras `a` não são JSON. Com dez requisições assim ao mesmo tempo, ou com um corpo de alguns gigabytes, o processo fica sem memória e cai para todos. E repare em quem pode fazer isso: qualquer um com uma credencial de escrita, porque a ordem do ponto de entrada deixa de fora os desconhecidos (o corpo só é lido na pergunta 7). É uma defesa, mas não basta: uma credencial de escrita também pode ser roubada ou mal usada.

Agora o verde, com o `revisor` da lição. A mesma medição:

```text
$ ps -o rss= -p $REV
 91616

$ head -c 52428800 /dev/zero | tr '\0' 'a' | curl -sS -o /dev/null -w '%{http_code} en %{time_total} s\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' --data-binary @-
413 en 0.002827 s

$ ps -o rss= -p $REV
 84272

$ curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
200
```

`413`, em uns três milésimos de segundo, e a memória **não cresceu**: passou de uns 92 MB para uns 84 MB, porque o coletor de lixo (garbage collector) do Node aproveitou para devolver memória (na execução de quem acompanha os números serão outros; o que importa é que não sobem). O `revisor` não guardou os 50 MB: respondeu o `413` assim que viu que passavam do limite, e o que continuou chegando ele leu e descartou sem guardar. Isto é o que `leerCuerpo` faz em `respuestas.ts` (é o mesmo da Lição 1, que já o usava como rede de segurança):

```ts
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

Ele tem duas defesas, porque há duas formas de enviar um corpo. Se a requisição traz `Content-Length` e já anuncia mais de 16 KiB (16.384 bytes), rejeita **sem guardar nada**. Se não traz, porque o corpo vem **em partes** (*chunked*, como apareceu na Lição 0), ou se o número mente, conta os bytes enquanto chegam e para de guardar assim que passam do limite. Nos dois casos nunca guarda mais de 16 KiB, e responde o `413` de imediato com um **fechamento em etapas**: fecha apenas a escrita (half-close), continua lendo e descartando o que o cliente conseguir enviar e destrói a conexão após 2 segundos se o cliente não a tiver fechado. Se respondesse e fechasse de uma vez com o cliente ainda enviando, o sistema operacional responderia com um RST, que pode apagar o `413` antes de o cliente lê-lo (RFC 9112, seção 9.6). Por que 16 KiB? Porque um serviço é um nome de até 40 caracteres, uma URL e um número: cabe muitas vezes. O limite é escolhido pelo que a rota precisa receber, não pelo que o servidor aguenta.

E quem lê o corpo, `leerJson`, transforma essa rejeição na resposta. A execução completa de 2.7 traz os três testes do limite:

```text
$ head -c 20000 /dev/zero | tr '\0' 'a' | curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' --data-binary @-
HTTP/1.1 413 Content Too Large
Connection: close
Content-Type: text/plain; charset=utf-8
Content-Length: 30
Date: Wed, 21 Oct 2026 23:42:11 GMT

el cuerpo pasa de 16384 bytes

$ head -c 20000 /dev/zero | tr '\0' 'a' | curl -sS -o /dev/null -w 'por partes: %{http_code}\n' -X POST -T - http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json'
por partes: 413

$ head -c 16384 /dev/zero | tr '\0' 'a' | curl -sS -o /dev/null -w 'en el tope: %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' --data-binary @-
en el tope: 400

$ curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
200
```

`413 Content Too Large`, que a [seção 15.5.14 do RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.14) define assim: o servidor se recusa a processar a requisição porque seu conteúdo é maior do que ele está disposto ou é capaz de processar, e **pode** fechar a conexão. O `revisor` faz isso com `Connection: close`: o Node fecha a conexão ao terminar de responder, e o que o cliente continuava enviando já foi drenado sem ser guardado. Ele não destrói a requisição antes, porque então não conseguiria responder nada. O segundo teste envia o corpo em partes (`-T -`), sem `Content-Length`, e também recebe `413`: ali funcionou a contagem durante a leitura. O terceiro envia **exatamente** 16.384 bytes, bem no limite: eles são lidos por completo e, como não são JSON, a resposta é `400`. E a consulta do final diz que o `revisor` continua vivo.

O `413` e o `415` são parentes: os dois dizem que o corpo não pode ser aceito **tal como vem**, um pelo formato e outro pelo tamanho, e os dois são decididos sem entender o conteúdo. Por isso vão juntos na pergunta do corpo, antes do `400`, que precisa lê-lo. Um detalhe de nome, já visto na Lição 0: o Node chama este código de «Payload Too Large», o nome antigo; o RFC 9110 o mudou para «Content Too Large», e `respuestas.ts` usa o do registro.

#### 2.6.5 O que ainda é `400`

Nesta lição há outras quatro situações que também respondem `400`, e convém vê-las juntas porque a Lição 3 vai mover algumas para outro código.

**JSON que não é um objeto.** `null`, `7`, `"pagos"` e `[]` são JSON válido, mas nenhum é um serviço. `leerJson` verifica isso antes de deixar o corpo passar, e responde `400 el cuerpo no es un objeto JSON`. Não é um detalhe: se `darDeAlta` recebesse `null` e lesse `datos.nombre`, o JavaScript lançaria um erro, e um erro que ninguém captura em um servidor Node encerra o processo. O exercício 4 percorre isso.

**Faltam campos.** Se o corpo é um objeto JSON, mas não traz `nombre` ou `url` como textos, o `revisor` responde `400 faltan nombre y url`.

**Um limite fora da faixa.** `limite_ms` é opcional e por padrão vale 2000, mas se vier, precisa ser um inteiro entre 100 e 10000:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"eterno","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3600000}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 47
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

limite_ms debe ser un entero entre 100 y 10000
```

A cota não é um capricho. O `revisor` espera a resposta de cada serviço no máximo `limite_ms` milissegundos, e sem cota, um limite de horas o deixaria esperando um serviço que não responde, com a conexão ocupada todo esse tempo; e um limite de zero o daria como fora do ar sem tê-lo consultado. Um campo numérico que o cliente controla e que o servidor usa para decidir quanto trabalho faz é um campo que sempre se limita. A validação vem **antes** de verificar o destino, porque verificar o destino resolve um nome por DNS, e não faz sentido gastar essa consulta em um cadastro que vai ser rejeitado de qualquer forma.

**Um destino proibido.** A defesa contra SSRF da Lição 1 continua no lugar: um cadastro que aponta para o endereço de metadados da nuvem ou para um nome que resolve para `127.0.0.1` é rejeitado com `400 destino prohibido: …`. A regra é a da Lição 1, e cobre muito mais do que as redes privadas. Em IPv4 é uma **lista de bloqueio** copiada do registro de endereços de uso especial da IANA: além de `10/8`, `172.16/12` e `192.168/16`, rejeita o espaço compartilhado dos provedores (`100.64.0.0/10`, onde uma nuvem publica seus metadados), as redes de documentação e de testes de desempenho, o *multicast* e o bloco reservado `240.0.0.0/4`. Em IPv6 é uma **lista de permissão**: só se aceita o unicast global, `2000::/3`, menos alguns blocos especiais que caem dentro dele (documentação, Teredo). E antes de aplicar qualquer uma das duas, extrai o IPv4 que alguns endereços IPv6 levam escondido em seus bits (`64:ff9b::…`, `2002:…`, `::…`) e o verifica como IPv4: `[2002:a9fe:a9fe::]` é `169.254.169.254` por dentro. A execução completa de 2.7 comprova isso com doze cadastros, um por bloco, e os doze são rejeitados:

```text
$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-1","url":"http://100.100.100.200/latest/meta-data/"}'
destino prohibido: 100.100.100.200:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-2","url":"http://[64:ff9b::a9fe:a9fe]/"}'
destino prohibido: [64:ff9b::a9fe:a9fe]:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-3","url":"http://224.0.0.1/"}'
destino prohibido: 224.0.0.1:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-4","url":"http://[ff02::1]/"}'
destino prohibido: [ff02::1]:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-5","url":"http://[2002:a9fe:a9fe::]/"}'
destino prohibido: [2002:a9fe:a9fe::]:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-6","url":"http://[::7f00:1]/"}'
destino prohibido: [::7f00:1]:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-7","url":"http://[64:ff9b:1::a9fe:a9fe]/"}'
destino prohibido: [64:ff9b:1::a9fe:a9fe]:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-8","url":"http://240.0.0.1/"}'
destino prohibido: 240.0.0.1:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-9","url":"http://198.18.0.1/"}'
destino prohibido: 198.18.0.1:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-10","url":"http://192.0.2.1/"}'
destino prohibido: 192.0.2.1:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-11","url":"http://[2001:db8::1]/"}'
destino prohibido: [2001:db8::1]:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-12","url":"http://[2001:0:4136:e378:8000:63bf:3fff:fdd2]/"}'
destino prohibido: [2001:0:4136:e378:8000:63bf:3fff:fdd2]:80: dirección privada o reservada
 [400]
```

As três últimas têm algo em comum: o corpo **pôde ser lido**, e o que falha é que o que foi lido não pode ser cumprido. A Lição 3 adota uma política escrita para essa diferença: `400` para o que não pode ser lido e `422` para o que é lido mas não pode ser cumprido. Por enquanto o `422` não existe no `revisor`, e tudo o que não pode ser usado do corpo é `400`. O código ser o mesmo não significa que o corpo deva ser: o texto de cada `400` diz o que falhou, e essa é a diferença entre um `400` útil e o da cena do começo.

### 2.7 O `revisor` completo

#### 2.7.1 Os arquivos que mudam

O `revisor` desta lição vive na pasta `~/curso-http/fig02_01/`. Com a pasta da Lição 1 em mãos, copie-a com esse nome e mude três arquivos: um novo, `autenticacion.ts` (seção 2.3.2), e dois modificados, `rutas.ts` e `servicios.ts`, completos aqui:

```ts
// fig02_01/rutas.ts — la puerta de la API: qué ruta existe, qué método admite y quién puede usarlo.
import type { IncomingMessage, ServerResponse } from "node:http";
import { identificar, motivo, reto, type Credencial } from "./autenticacion.ts";
import { enviarVacio, fallar } from "./respuestas.ts";
import {
  consultar, consultarRevision, darDeAlta, listar, pedirRevision, retirar, type Contexto,
} from "./servicios.ts";

type Manejador = (contexto: Contexto) => void | Promise<void>;
// Cada método dice qué función lo atiende y qué rol mínimo exige.
type Metodo = { manejador: Manejador; escribe: boolean };
type Ruta = { patron: RegExp; metodos: Record<string, Metodo> };

const lee = (manejador: Manejador): Metodo => ({ manejador, escribe: false });
const escribe = (manejador: Manejador): Metodo => ({ manejador, escribe: true });

const RUTAS: Ruta[] = [
  { patron: /^\/servicios$/, metodos: { GET: lee(listar), POST: escribe(darDeAlta) } },
  { patron: /^\/servicios\/(\d+)$/, metodos: { GET: lee(consultar), DELETE: escribe(retirar) } },
  { patron: /^\/servicios\/(\d+)\/revisiones$/, metodos: { POST: escribe(pedirRevision) } },
  { patron: /^\/revisiones\/(\d+)$/, metodos: { GET: lee(consultarRevision) } },
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

  // 5, 6 y 7. ¿Existe el recurso? ¿En qué formato viene? ¿Se puede leer? Lo decide cada manejador.
  await metodo.manejador({ peticion, respuesta, parametros, credencial: identificacion.credencial });
}
```

```ts
// fig02_01/servicios.ts — lo que hace cada ruta de la API del revisor.
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  buscarRevision, buscarServicio, crearRevision, crearServicio, etiqueta, listarServicios,
  retirarServicio, terminarRevision, type Revision, type Servicio,
} from "./almacen.ts";
import type { Credencial } from "./autenticacion.ts";
import { revisarDestino } from "./destinos.ts";
import { coincideDebil, hayCoincidencia } from "./etiquetas.ts";
import { revisar } from "./cliente.ts";
import { CuerpoDemasiadoGrande, enviarJson, enviarVacio, fallar, leerCuerpo, TOPE_CUERPO, type Cabeceras } from "./respuestas.ts";

export type Contexto = {
  peticion: IncomingMessage;
  respuesta: ServerResponse;
  parametros: string[];
  credencial: Credencial;
};

const ESPERA_EN_COLA_MS = 1000;

function representar(servicio: Servicio): object {
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

// Un servicio de otro equipo se trata como si no existiera: el 404 esconde a propósito.
function visible(id: string, credencial: Credencial): Servicio | undefined {
  const servicio = buscarServicio(Number(id));
  if (servicio === undefined) return undefined;
  return credencial.equipo === "*" || servicio.equipo === credencial.equipo ? servicio : undefined;
}

function noExiste(respuesta: ServerResponse, id: string): void {
  fallar(respuesta, 404, `no existe el servicio ${id}`);
}

// Lee el cuerpo como JSON. Si no puede, ya respondió 415 o 400 y devuelve undefined.
async function leerJson(peticion: IncomingMessage, respuesta: ServerResponse): Promise<Record<string, unknown> | undefined> {
  const tipo = (peticion.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  if (tipo !== "application/json") {
    fallar(respuesta, 415, `el cuerpo debe ser application/json, no ${tipo === "" ? "(sin tipo)" : tipo}`, {
      Accept: "application/json",
    });
    return undefined;
  }
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

// SSRF: el revisor se conecta a la URL que alguien escribió. Se revisa al registrarla y otra vez
// antes de cada conexión (en cliente.ts). Si no se permite, ya respondió y devuelve false.
async function destinoPermitido(url: string, respuesta: ServerResponse): Promise<boolean> {
  const veredicto = await revisarDestino(url);
  if (veredicto.permitido) return true;
  fallar(respuesta, 400, `destino prohibido: ${veredicto.motivo}`);
  return false;
}

export function listar({ respuesta, credencial }: Contexto): void {
  const propios = listarServicios().filter((s) => credencial.equipo === "*" || s.equipo === credencial.equipo);
  enviarJson(respuesta, 200, { servicios: propios.map(representar) });
}

export async function darDeAlta({ peticion, respuesta, credencial }: Contexto): Promise<void> {
  const datos = await leerJson(peticion, respuesta);
  if (datos === undefined) return;
  if (typeof datos.nombre !== "string" || typeof datos.url !== "string") {
    fallar(respuesta, 400, "faltan nombre y url");
    return;
  }
  if (urlConSecretos(datos.url)) {
    fallar(respuesta, 400, "url no puede llevar usuario, clave, consulta (?) ni fragmento (#)");
    return;
  }
  // limite_ms es opcional, pero si viene se acota: sin cota, un límite de horas dejaría al revisor
  // esperando a un servicio que no responde, y uno de 0 lo daría por caído sin consultarlo.
  const limiteMs = datos.limite_ms === undefined ? 2000 : datos.limite_ms;
  if (typeof limiteMs !== "number" || !Number.isInteger(limiteMs) || limiteMs < 100 || limiteMs > 10000) {
    fallar(respuesta, 400, "limite_ms debe ser un entero entre 100 y 10000");
    return;
  }
  if (!(await destinoPermitido(datos.url, respuesta))) return;
  const servicio = crearServicio({ nombre: datos.nombre, url: datos.url, limiteMs, equipo: credencial.equipo });
  enviarJson(respuesta, 201, representar(servicio), {
    Location: `/servicios/${servicio.id}`,
    ETag: etiqueta(servicio),
  });
}

export function consultar({ peticion, respuesta, parametros, credencial }: Contexto): void {
  const servicio = visible(parametros[0], credencial);
  if (servicio === undefined) {
    noExiste(respuesta, parametros[0]);
    return;
  }
  const actual = etiqueta(servicio);
  // If-None-Match trae «*» o una lista, y se compara en débil (RFC 9110, secciones 13.1.2 y 8.8.3.2).
  const condicion = peticion.headers["if-none-match"];
  if (condicion !== undefined && hayCoincidencia(condicion, actual, coincideDebil)) {
    enviarVacio(respuesta, 304, { ETag: actual });
    return;
  }
  enviarJson(respuesta, 200, representar(servicio), { ETag: actual });
}

export function retirar({ respuesta, parametros, credencial }: Contexto): void {
  const servicio = visible(parametros[0], credencial);
  if (servicio === undefined) {
    noExiste(respuesta, parametros[0]);
    return;
  }
  retirarServicio(servicio.id);
  enviarVacio(respuesta, 204);
}

export function pedirRevision({ respuesta, parametros, credencial }: Contexto): void {
  const servicio = visible(parametros[0], credencial);
  if (servicio === undefined) {
    noExiste(respuesta, parametros[0]);
    return;
  }
  const revision = crearRevision(servicio.id);
  setTimeout(async () => {
    terminarRevision(revision.id, await revisar(servicio.url, servicio.limiteMs));
  }, ESPERA_EN_COLA_MS);
  enviarJson(respuesta, 202, representarRevision(revision), { Location: `/revisiones/${revision.id}` });
}

export function consultarRevision({ respuesta, parametros, credencial }: Contexto): void {
  const revision = buscarRevision(Number(parametros[0]));
  if (revision === undefined || visible(String(revision.servicio), credencial) === undefined) {
    fallar(respuesta, 404, `no existe la revisión ${parametros[0]}`);
    return;
  }
  const cabeceras: Cabeceras = revision.estado === "pendiente" ? { "Retry-After": "1" } : {};
  enviarJson(respuesta, 200, representarRevision(revision), cabeceras);
}
```

Em `servicios.ts`, além do que já foi visto (`visible`, `noExiste`, `leerJson` e a cota de `limite_ms`), mudou o `Contexto`: agora ele traz a credencial que o ponto de entrada verificou, e cada handler a recebe. Nenhum handler volta a ler o cabeçalho `Authorization`; o ponto de entrada fez isso uma vez e passou o resultado. Assim há um único lugar onde se decide quem é quem.

#### 2.7.2 Os arquivos que não mudam

Os demais arquivos são os da Lição 1, sem uma única mudança. Vão completos para que o `revisor` possa ser montado a partir desta lição:

```ts
// fig02_01/almacen.ts — los servicios que observa el revisor y las revisiones pedidas, en memoria.
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

export function retirarServicio(id: number): boolean {
  return servicios.delete(id);
}

export function crearRevision(servicio: number): Revision {
  const revision: Revision = { id: siguienteRevision++, servicio, estado: "pendiente", resultado: null };
  revisiones.set(revision.id, revision);
  return revision;
}

export function buscarRevision(id: number): Revision | undefined {
  return revisiones.get(id);
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
```

```ts
// fig02_01/cliente.ts — la cara cliente del revisor: consulta un servicio y clasifica lo que respondió.
import type { Resultado } from "./almacen.ts";
import { revisarDestino } from "./destinos.ts";

export async function revisar(url: string, limiteMs: number): Promise<Resultado> {
  // Antes de CADA conexión se vuelve a revisar el destino: el DNS pudo cambiar desde el alta.
  // LÍMITE DECLARADO: esto NO cierra el DNS rebinding. fetch vuelve a resolver el nombre, y entre
  // esta revisión y la conexión el nombre puede apuntar a otra IP. La lección 8 lo completa:
  // se conecta a la IP ya validada, con http.request y su opción lookup.
  const veredicto = await revisarDestino(url);
  if (!veredicto.permitido) return { estado: "CAIDO", codigo: null, ms: null, detalle: `destino prohibido: ${veredicto.motivo}` };
  const inicio = performance.now();
  try {
    const respuesta = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(limiteMs) });
    await respuesta.body?.cancel();
    const ms = Math.round(performance.now() - inicio);
    const detalle = String(respuesta.status);
    if (respuesta.status >= 400) return { estado: "CAIDO", codigo: respuesta.status, ms, detalle };
    return { estado: ms >= limiteMs / 2 ? "LENTO" : "ARRIBA", codigo: respuesta.status, ms, detalle };
  } catch (error) {
    const agotado = error instanceof DOMException && error.name === "TimeoutError";
    return { estado: "CAIDO", codigo: null, ms: null, detalle: agotado ? "tiempo agotado" : "sin conexión" };
  }
}
```

```ts
// fig02_01/destinos.ts — a dónde puede conectarse el revisor. Defensa contra SSRF.
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
// fig02_01/etiquetas.ts — leer y comparar etiquetas (ETag) como pide el RFC 9110.
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
// fig02_01/laboratorio.ts
// El banco de pruebas de la lección 0, en el puerto 18081: los servicios que el revisor consulta.
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
// fig02_01/respuestas.ts — las tres formas de responder del revisor y la lectura del cuerpo.
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
// fig02_01/servidor.ts — la cara servidor del revisor: la API que administra los servicios observados.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fallar } from "./respuestas.ts";
import { atender } from "./rutas.ts";

const PUERTO = 18080;

// Red de seguridad: un error que se escape de un manejador no debe tumbar el proceso. Sin este catch,
// la promesa rechazada no la espera nadie y Node termina el revisor para todos. Se responde 500 sin
// pila y el mensaje queda en la terminal. La lección 4 explica el 500 y le agrega una referencia.
async function atenderSinCaerse(peticion: IncomingMessage, respuesta: ServerResponse): Promise<void> {
  try {
    await atender(peticion, respuesta);
  } catch (error) {
    console.error(`error en ${peticion.method} ${peticion.url}: ${error instanceof Error ? error.message : String(error)}`);
    if (!respuesta.headersSent) fallar(respuesta, 500, "error interno");
    else respuesta.destroy();
  }
}

createServer((peticion, respuesta) => void atenderSinCaerse(peticion, respuesta)).listen(PUERTO, "127.0.0.1", () => {
  console.log(`revisor en http://127.0.0.1:${PUERTO}`);
});
```

```json fig02_01/package.json
{
  "type": "module"
}
```

#### 2.7.3 A execução completa

Abra dois terminais em `~/curso-http/fig02_01/`. No primeiro, o laboratório, que é o ambiente de testes da Lição 0 na porta 18081; no segundo, o `revisor`:

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

Em um terceiro terminal, estas são as requisições da lição, em ordem, com o que responderam. As principais das seções anteriores estão aqui de novo, juntas, para comparar de uma vez com as próprias:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: text/plain; charset=utf-8
Content-Length: 20
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

falta la credencial

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer inventada'
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor", error="invalid_token"
Content-Type: text/plain; charset=utf-8
Content-Length: 28
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

la credencial no es válida

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer constructor'
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor", error="invalid_token"
Content-Type: text/plain; charset=utf-8
Content-Length: 28
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

la credencial no es válida

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 189
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000}]}

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 3

$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 25
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 99

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b'
HTTP/1.1 200 OK
ETag: "3-1-a06a8084"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X DELETE http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu credencial solo puede leer; para escribir pide una con rol de escritor

$ curl -i -X PATCH http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, DELETE
Content-Type: text/plain; charset=utf-8
Content-Length: 35
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

PATCH no se admite en /servicios/1

$ curl -i http://127.0.0.1:18080/servicioss -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 19
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe esa ruta

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -d 'nombre=inventario'
HTTP/1.1 415 Unsupported Media Type
Accept: application/json
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo debe ser application/json, no application/x-www-form-urlencoded

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -d 'inventario'
HTTP/1.1 415 Unsupported Media Type
Accept: application/json
Content-Type: text/plain; charset=utf-8
Content-Length: 51
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo debe ser application/json, no text/plain

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre": "inventario",'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 31
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo no es un objeto JSON

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/4
ETag: "4-1-a06a8084"
Content-Type: application/json
Content-Length: 90
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"metadatos","url":"http://169.254.169.254/latest/meta-data/"}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 70
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: 169.254.169.254:80: dirección privada o reservada

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"yo-mismo","url":"http://localhost:18080/mantenimiento"}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 75
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: localhost resuelve a una dirección privada o reservada

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"eterno","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3600000}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 47
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

limite_ms debe ser un entero entre 100 y 10000
```

Dezessete requisições e oito códigos diferentes: `[401 401 401 200 404 404 200 403 405 404 415 415 400 201 400 400 400]`. Cada erro é o «não» de uma das sete perguntas, e cada sucesso, uma requisição que passou por todas.

#### 2.7.4 A tag continua funcionando atrás do ponto de entrada

O ponto de entrada não mudou nada do que a Lição 1 construiu: as requisições condicionais com `If-None-Match` respondem igual, agora com uma credencial. A `ETag` do `revisor` tem três partes, `"id-versión-arranque"`: a última são oito dígitos aleatórios que o `revisor` sorteia toda vez que inicia, para que uma tag de antes de uma reinicialização não coincida, na prática, com uma de depois (são 32 bits aleatórios: uma probabilidade de uma em 4,295 bilhões por cada inicialização anterior, e não uma garantia matemática; a Lição 1 explica por quê: o [RFC 9110, seção 8.8.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.1), não permite reutilizar uma tag para outra representação). Por isso, para repetir estas requisições, primeiro é preciso ler a tag vigente. A execução a guardou em uma variável do terminal, `ETAG`, com a opção `-w '%header{etag}'` do `curl`, que imprime só esse cabeçalho:

```text
$ ETAG=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'); echo "ETAG=$ETAG"
ETAG="1-1-a06a8084"

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H "If-None-Match: W/$ETAG"
HTTP/1.1 304 Not Modified
ETag: "1-1-a06a8084"
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H "If-None-Match: \"9-9\", $ETAG"
HTTP/1.1 304 Not Modified
ETag: "1-1-a06a8084"
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H 'If-None-Match: *'
HTTP/1.1 304 Not Modified
ETag: "1-1-a06a8084"
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H 'If-None-Match: "9-9", W/"8-8"'
HTTP/1.1 200 OK
ETag: "1-1-a06a8084"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

As três primeiras são `304`: `If-None-Match` aceita a tag fraca (`W/`), uma lista e `*`, como a Lição 1 ensinou. A quarta, uma lista sem a tag vigente, recebe o serviço completo. E o teste da reinicialização: leu-se a tag do serviço 3, parou-se o `revisor` e ele foi iniciado de novo (no terminal, com `Ctrl`+`C` e `node servidor.ts`), e pediu-se o serviço 3 com a tag de antes:

```text
$ ANTES=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b'); echo "ANTES=$ANTES"
ANTES="3-1-a06a8084"

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b' -H "If-None-Match: $ANTES"
HTTP/1.1 200 OK
ETag: "3-1-ae8e4dbe"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

`200`, com uma tag nova: o serviço 3 tem o mesmo id e a mesma versão de antes da reinicialização, mas os oito dígitos do final mudaram, e a cópia antiga do cliente já não é dada como boa.

O terminal do `revisor` anotou cada requisição que chegou na execução, nesta ordem: as dezessete de 2.7.3; a de 2.2.3 e a de 2.4.2; as da tag; a de 2.3.1 em minúsculas e a de `Basic` (o método `constructor` de 2.3.3 não aparece, porque o Node o rejeitou antes); os três cadastros de corpos grandes de 2.6.4 e a consulta que comprova que o `revisor` continua vivo; um cadastro com `-d 'null'` seguido de uma consulta, para comprovar que o `revisor` continua vivo (o exercício 4 repete isso); os doze cadastros de faixas de 2.6.5, e os dois da reinicialização, um antes e outro depois. Repare no segundo `revisor en …`, o da segunda vida do processo:

```text
revisor en http://127.0.0.1:18080
GET /servicios
GET /servicios
GET /servicios
GET /servicios
GET /servicios/3
GET /servicios/99
GET /servicios/3
DELETE /servicios/1
PATCH /servicios/1
GET /servicioss
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
HEAD /servicios/1/revisiones
DELETE /servicios/99
GET /servicios/1
GET /servicios/1
GET /servicios/1
GET /servicios/1
GET /servicios/1
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
GET /servicios/3
revisor en http://127.0.0.1:18080
GET /servicios/3
```

## O erro a ser observado

### O `403` que denuncia

Este é o código que quase todo mundo escreve na primeira vez que separa os serviços por equipe, porque se lê de forma muito natural: procuro o serviço; se não existe, `404`; se existe e é de outra equipe, `403`. Para provocá-lo, copie a pasta `fig02_01/` como `rota/` e mude o início de `consultar` em `rota/servicios.ts` para isto (é um fragmento; a versão completa está em `defectos/403/servicios.ts`):

```ts
export function consultar({ peticion, respuesta, parametros, credencial }: Contexto): void {
  const servicio = buscarServicio(Number(parametros[0]));
  if (servicio === undefined) {
    noExiste(respuesta, parametros[0]);
    return;
  }
  if (credencial.equipo !== "*" && servicio.equipo !== credencial.equipo) {
    fallar(respuesta, 403, `el servicio ${parametros[0]} es de otro equipo`);
    return;
  }
```

Inicie o laboratório e o `revisor` a partir de `rota/` e repita o par de 2.5.2:

```text
$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 32
Date: Wed, 21 Oct 2026 13:18:14 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 3 es de otro equipo

$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 25
Date: Wed, 21 Oct 2026 13:18:14 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 99
```

Cada resposta, separadamente, parece impecável: o `403` é um código permitido para um recurso proibido, explica no corpo por que se recusou, e o `404` diz a verdade. O problema está no **par**. Passe o enumerador:

```text
$ node fig02_02.ts lectura-a
servicio 1: 200 {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
servicio 2: 200 {"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000}
servicio 3: 403 el servicio 3 es de otro equipo
servicio 4: 404 no existe el servicio 4
servicio 5: 404 no existe el servicio 5
servicio 6: 404 no existe el servicio 6

respuestas distintas: 3
  1, 2               → 200 con datos
  3                  → 403 el servicio N es de otro equipo
  4, 5, 6            → 404 no existe el servicio N
más de dos respuestas: lo que no es tuyo ya no se ve todo igual
```

Três grupos, e o programa avisa. O 3 recebeu uma resposta que nenhum identificador inexistente recebe, então `lectura-a` agora sabe que o serviço 3 existe, e que é de outra equipe, sem ter visto nenhum de seus dados. Com identificadores de 1 a 100.000, saberia quantos serviços a empresa tem e quais são de outras equipes. Isso é a enumeração do quadro de 2.5, produzida por quatro linhas que ninguém escreveu com má intenção.

A correção é voltar a `visible`: uma única função que retorna `undefined` para o alheio e para o inexistente, e um único ramo que responde. Não basta trocar o `403` por um `404` mantendo os dois ramos: no dia em que alguém editar o texto de um e não o do outro, a diferença volta, agora no corpo. Pare os programas de `rota/` ao terminar.

### A credencial que ninguém emitiu

O segundo erro é o da seção 2.3.3. Copie de novo `fig02_01/` como `rota2/` e troque em `rota2/autenticacion.ts` a tabela e a busca pela forma com um objeto (a versão completa está em `defectos/prototipo/autenticacion.ts`):

```ts
const CREDENCIALES: Record<string, Credencial> = {
  "lectura-a": { nombre: "lectura-a", equipo: "a", rol: "lector" },
  "escritura-a": { nombre: "escritura-a", equipo: "a", rol: "escritor" },
  "escritura-b": { nombre: "escritura-b", equipo: "b", rol: "escritor" },
  "admin": { nombre: "admin", equipo: "*", rol: "admin" },
};
```

```ts
  const credencial = encontrada === null ? undefined : CREDENCIALES[encontrada[1]];
```

O TypeScript não reclama de nenhuma das duas mudanças: para ele, `CREDENCIALES[token]` é uma `Credencial`. Inicie o laboratório e o `revisor` a partir de `rota2/` e teste com duas palavras que ninguém cadastrou:

```text
$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer constructor'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 17
Date: Wed, 21 Oct 2026 13:18:15 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[]}

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer toString'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 17
Date: Wed, 21 Oct 2026 13:18:15 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[]}
```

`200 OK`. O ponto de entrada deixou passar `constructor` e `toString` como se fossem credenciais. `CREDENCIALES["constructor"]` encontrou a função `Object`, que todo objeto herda; `CREDENCIALES["toString"]`, a função de mesmo nome. Nenhuma é `undefined`, então `identificar` respondeu «válida». A lista sair vazia é pura sorte: essas «credenciais» não têm `equipo`, e o filtro de `listar` não encontra nenhum serviço cuja equipe seja `undefined`. Veja o que acontece ao tentar escrever e ao consultar:

```text
$ curl -i -X DELETE http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer constructor'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:15 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu credencial solo puede leer; para escribir pide una con rol de escritor

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer constructor'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:18:15 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 1
```

O `403` diz «tu credencial solo puede leer»: o ponto de entrada acredita que sabe quem pede, embora por trás não haja ninguém; só não o deixou escrever porque a função `Object` não tem `rol`. E ao consultar, `404`: seu `equipo` é `undefined`, então `visible` não deixa ver nem o serviço 1, que é da equipe a. Desta vez nada quebrou, por sorte. Mas a terceira pergunta do ponto de entrada já respondeu «sim» a alguém que não existe, e qualquer regra que só pergunte «se identificou?» o deixaria passar: um log de auditoria anotaria um usuário `undefined`, um limite de requisições por credencial o trataria como mais um, e uma rota que só exige estar identificado lhe responderia. Com o `Map` de `fig02_01/`, as mesmas requisições dão `401` com `error="invalid_token"`, como mostra a terceira requisição da execução completa de 2.7. Pare os programas de `rota2/` ao terminar.

## O que se costuma fazer de errado

**Um `401` sem `WWW-Authenticate`.** É o erro mais comum com este código, e a especificação o proíbe com um **deve**. Sem o desafio, o cliente sabe que precisa se identificar, mas não como; alguns clientes HTTP, além disso, não tentam se autenticar se não veem o desafio.

**Um `405` sem `Allow`, ou com um `Allow` que mente.** O primeiro deixa o cliente testando métodos às cegas. O segundo é pior: se `Allow` diz `PUT` e o `PUT` responde `405`, o cliente já não pode confiar em nada do que a API diz. No `revisor`, `Allow` é calculado com a mesma tabela que decide que método é atendido, então não pode se desviar; escrevê-lo manualmente em cada resposta é a forma de ele se desviar.

**`404` para um método que não é admitido.** É o que o `revisor` da Lição 1 fazia, e manda o cliente procurar um endereço que estava certo.

**`403` para quem não se identificou.** Se o servidor não sabe quem pede, não pode dizer que não lhe cabe: o código é `401`, com seu desafio. Um `403` a um cliente sem credencial diz «não insista», quando o que ele precisava fazer era se identificar.

**`401` para quem se identificou bem, mas não tem permissão.** O erro contrário. O cliente tenta de novo com a mesma credencial, ou pede uma nova, e recebe o mesmo para sempre.

**Validar o corpo antes da credencial.** Ensina a um desconhecido, à força de `400`, o que a API espera e que valores admite, e gasta trabalho do servidor em requisições que seriam rejeitadas de qualquer forma.

**Responder diferente ao alheio e ao inexistente.** Um `403` versus um `404`, ou um `404` com «não existe» versus um `404` com «é de outra equipe», ou o mesmo texto com um tamanho diferente. Qualquer uma das três diferenças basta para enumerar. O quadro de 2.5 explica o custo.

**`400` para tudo.** Um cliente que recebe o mesmo `400` quando o formato está errado, quando o JSON está cortado ou quando falta um campo não consegue decidir pelo código o que corrigir; só lhe resta interpretar o texto, e um programa não deve decidir com frases. Cada pergunta do ponto de entrada tem seu código para que o cliente saiba qual falhou.

**Ler o corpo sem limite.** Qualquer um que chegue à rota pode encher a memória do servidor com um único `POST`, e a seção 2.6.4 mediu quanto: uns 150 MB por requisição. O limite é fixado pelo que a rota precisa e verificado **enquanto** se lê, não depois.

**Repetir a credencial na mensagem de erro.** O cliente já sabe que credencial enviou; os logs, caches e capturas de tela por onde a resposta passa não devem saber.

**Deixar uma exceção do leitor de JSON virar `500`.** `JSON.parse` lança uma exceção com um JSON malformado. Se ninguém a captura, o servidor responde `500` (ou, no Node, cai): culpa o servidor por um erro do cliente. `leerJson` captura a exceção e a converte no `400` que ela é.

## Exercícios

Os quatro se corrigem sozinhos: cada um termina com uma execução que diz se a previsão estava certa. Escreva a previsão no [diário de bordo](bitacora.md) **antes** de rodar qualquer coisa. Para todos é preciso o laboratório e o `revisor` de 2.7 rodando, recém-iniciados (o `revisor` guarda tudo em memória, e um cadastro ou uma remoção anterior muda as respostas).

### Exercício 1 — Em que pergunta ela para?

Sem rodar nada, preveja o código de cada uma destas sete requisições, e em que pergunta do ponto de entrada cada uma para:

```bash
curl -i -X PATCH http://127.0.0.1:18080/servicios/1
curl -i -X DELETE http://127.0.0.1:18080/servicios/99
curl -i -X DELETE http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer lectura-a'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -d 'catalogo'
curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-b'
curl -i -X POST http://127.0.0.1:18080/servicios/1/revisiones -H 'Authorization: Bearer lectura-a'
curl -i http://127.0.0.1:18080/nada
```

Depois rode-as e compare. Se alguma previsão falhou, a pista está na ordem: procure a primeira pergunta cuja resposta é «não».

### Exercício 2 — O que `Allow` diz

Preveja o cabeçalho `Allow` destas três respostas, e se elas são de fato `405`:

```bash
curl -i -X DELETE http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer lectura-a'
curl -I http://127.0.0.1:18080/servicios
curl -i -X PUT http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a'
```

`-I` envia um `HEAD`, e `-X` muda o método. Rode as três e compare.

### Exercício 3 — O enumerador com outras credenciais

Preveja o que `fig02_02.ts` imprime com `escritura-b`, com `admin` e com uma credencial inventada, `nadie`. Em qual das três o programa «descobre» mais serviços, e por que isso não é um vazamento? Rode os três:

```bash
node fig02_02.ts escritura-b
node fig02_02.ts admin
node fig02_02.ts nadie
```

### Exercício 4 — JSON que não é um serviço

Preveja o código e o corpo de cada um destes cinco cadastros. Todos trazem uma credencial de escrita e dizem ser `application/json`, e todos falham, mas não no mesmo lugar:

```bash
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d 'null'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '7'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '[]'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{}'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json; charset=utf-8' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200","limite_ms":"rapido"}'
```

Repare no `Content-Type` do último: traz um parâmetro, `charset=utf-8`. `leerJson` o aceita? Rode os cinco e compare. Para cada um, diga qual das sete perguntas o parou, ou se ele passou pelas sete e foi parado por uma regra do cadastro.

## Soluções

### Solução 1

```text
$ curl -i -X PATCH http://127.0.0.1:18080/servicios/1
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, DELETE
Content-Type: text/plain; charset=utf-8
Content-Length: 35
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

PATCH no se admite en /servicios/1

$ curl -i -X DELETE http://127.0.0.1:18080/servicios/99
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: text/plain; charset=utf-8
Content-Length: 20
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

falta la credencial

$ curl -i -X DELETE http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu credencial solo puede leer; para escribir pide una con rol de escritor

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -d 'catalogo'
HTTP/1.1 415 Unsupported Media Type
Accept: application/json
Content-Type: text/plain; charset=utf-8
Content-Length: 51
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo debe ser application/json, no text/plain

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-b'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 1

$ curl -i -X POST http://127.0.0.1:18080/servicios/1/revisiones -H 'Authorization: Bearer lectura-a'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu credencial solo puede leer; para escribir pide una con rol de escritor

$ curl -i http://127.0.0.1:18080/nada
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 19
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe esa ruta
```

Em ordem: `405` (pergunta 2: a rota existe e não admite `PATCH`, e parou antes de perguntar quem é); `401` (pergunta 3: a rota e o método existem, falta a credencial, e o 99 nem foi consultado); `403` (pergunta 4: um leitor não apaga, exista ou não o 99); `415` (pergunta 6: o escritor pode cadastrar, mas o corpo não é JSON); `404` (pergunta 5: o serviço 1 é da equipe a, e para `escritura-b` ele não existe); `403` (pergunta 4: pedir uma verificação é escrever, e `lectura-a` só lê); `404` (pergunta 1: `/nada` não está na tabela, e não foi preciso credencial). Se o segundo ou o terceiro falharam, revise 2.1.2: são as duas linhas em que a ordem do ponto de entrada esconde se o 99 existe.

### Solução 2

```text
$ curl -i -X DELETE http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD
Content-Type: text/plain; charset=utf-8
Content-Length: 37
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

DELETE no se admite en /revisiones/1

$ curl -I http://127.0.0.1:18080/servicios
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: text/plain; charset=utf-8
Content-Length: 20
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i -X PUT http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a'
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, POST
Content-Type: text/plain; charset=utf-8
Content-Length: 31
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

PUT no se admite en /servicios
```

O primeiro é `405` com `Allow: GET, HEAD`: `/revisiones/1` só se consulta. O segundo **não é um `405`**: `HEAD` é admitido onde `GET` é admitido, e `/servicios` admite `GET`, então o ponto de entrada passou para a pergunta 3 e respondeu `401`, com seu desafio, e sem corpo porque era um `HEAD` (o `Content-Length: 20` diz quanto mediria o de um `GET`, como na Lição 0). O terceiro é `405` com `Allow: GET, HEAD, POST`, os métodos da coleção. Repare que os três `Allow` saíram da mesma tabela de `rutas.ts`, sem escrever nenhum manualmente.

### Solução 3

```text
$ node fig02_02.ts escritura-b
servicio 1: 404 no existe el servicio 1
servicio 2: 404 no existe el servicio 2
servicio 3: 200 {"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
servicio 4: 404 no existe el servicio 4
servicio 5: 404 no existe el servicio 5
servicio 6: 404 no existe el servicio 6

respuestas distintas: 2
  1, 2, 4, 5, 6      → 404 no existe el servicio N
  3                  → 200 con datos

$ node fig02_02.ts admin
servicio 1: 200 {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
servicio 2: 200 {"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000}
servicio 3: 200 {"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
servicio 4: 404 no existe el servicio 4
servicio 5: 404 no existe el servicio 5
servicio 6: 404 no existe el servicio 6

respuestas distintas: 2
  1, 2, 3            → 200 con datos
  4, 5, 6            → 404 no existe el servicio N

$ node fig02_02.ts nadie
servicio 1: 401 la credencial no es válida
servicio 2: 401 la credencial no es válida
servicio 3: 401 la credencial no es válida
servicio 4: 401 la credencial no es válida
servicio 5: 401 la credencial no es válida
servicio 6: 401 la credencial no es válida

respuestas distintas: 1
  1, 2, 3, 4, 5, 6   → 401 la credencial no es válida
```

`escritura-b` vê só o 3, e para ele o 1 e o 2 são tão inexistentes quanto o 6. `admin` «descobre» três serviços, mas não é um vazamento: o administrador tem equipe `*` e pode ver todos, então ver os três é sua permissão, não uma dedução. E `nadie` não aprende nada: os seis identificadores recebem o mesmo `401`, porque a credencial é perguntada antes da existência. Nos três casos há no máximo dois grupos, e o aviso do programa não aparece.

### Solução 4

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d 'null'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 31
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo no es un objeto JSON

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '7'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 31
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo no es un objeto JSON

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '[]'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 31
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo no es un objeto JSON

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 20
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

faltan nombre y url

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json; charset=utf-8' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200","limite_ms":"rapido"}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 47
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

limite_ms debe ser un entero entre 100 y 10000
```

Os cinco passaram pelas seis primeiras perguntas: a rota existe, admite `POST`, a credencial é válida e pode escrever, uma coleção não tem um recurso que possa não existir, e o tipo é JSON. O último também, embora seu `Content-Type` traga `; charset=utf-8`: `leerJson` fica com o que vem antes do `;`, como se viu em 2.6.1. Os três primeiros param na pergunta 7: `null`, `7` e `[]` são lidos como JSON, mas não são um objeto, e `leerJson` os rejeita com `el cuerpo no es un objeto JSON`. Os dois últimos são objetos e passam pelas sete perguntas; quem os para são as regras do cadastro: `{}` não traz `nombre` nem `url`, e `"rapido"` não é um inteiro entre 100 e 10000. Repare que o texto de cada `400` é diferente: com o mesmo código, o corpo diz o que corrigir. E no que não aconteceu: nenhum dos cinco derrubou o `revisor`, que continua respondendo à requisição seguinte.

## Critérios de sucesso

- [ ] Dá para dizer de memória as sete perguntas do ponto de entrada em ordem, e para cada uma, seu código.
- [ ] `curl -i http://127.0.0.1:18080/servicios` sem credencial dá `401` com `WWW-Authenticate: Bearer realm="revisor"`, e com `Authorization: Bearer inventada` dá `401` com `error="invalid_token"` no desafio.
- [ ] Com `Authorization: Basic …` a resposta é `401` com o desafio **sem** `error`, e com `bearer lectura-a`, em minúsculas, é `200`.
- [ ] `curl -i -X PATCH` para `/servicios/1` dá `405` com `Allow: GET, HEAD, DELETE`, e `/servicioss` dá `404`.
- [ ] `curl -i -X DELETE` para `/servicios/1` e para `/servicios/99` com `lectura-a` dão os dois `403`, e dá para explicar por que o segundo não é `404`.
- [ ] `lectura-a` pede `/servicios/3` e `/servicios/99`, e as duas respostas são idênticas exceto pelo número; `escritura-b` vê o 3.
- [ ] `node fig02_02.ts lectura-a` conclui que só existem os serviços 1 e 2.
- [ ] Um `POST` com `curl -d` sem `Content-Type` dá `415` com `Accept: application/json`, e um com JSON cortado dá `400`.
- [ ] Um `POST` de 20.000 bytes dá `413` com `Connection: close`, com `Content-Length` e em partes, e um de 16.384 bytes dá `400`.
- [ ] Dá para explicar por que a tabela de credenciais é um `Map` e não um objeto, com a execução de `Bearer constructor`.
- [ ] Ao terminar, não sobra nenhum programa escutando: `curl -i http://127.0.0.1:18080/` dá o erro 7.

## Resumo

Responda sem olhar a lição:

1. Quais são as sete perguntas do ponto de entrada, em ordem, e que código cada uma responde quando a resposta é «não»?
2. Que cabeçalho um `401` exige e qual um `405` exige? Que seção do RFC 9110 diz isso?
3. Que pergunta decide entre `401` e `403`?
4. Por que a credencial vem antes da existência? E por que a permissão do papel vem antes da existência?
5. O que o RFC 9110 permite fazer com um recurso proibido cuja existência se quer esconder?
6. O que é a enumeração de recursos, e que três caminhos o `revisor` fecha para impedi-la?
7. Por que `415` vem antes de `400`? Que cabeçalho ajuda o cliente em um `415`, e ele é obrigatório?
8. Por que `CREDENCIALES[token]` sobre um objeto JavaScript pode aceitar uma credencial que ninguém cadastrou?
9. O que o `413` e o `415` têm em comum? Por que `leerCuerpo` precisa de duas defesas para o tamanho, e não uma?

## Fontes

Todas foram consultadas em 21 de outubro de 2026.

1. [RFC 9110, *HTTP Semantics*](https://www.rfc-editor.org/rfc/rfc9110.html), seção 15.5.1: o `400` e sua definição ampla, «algo que é percebido como um erro do cliente».
2. [RFC 9110, seção 15.5.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.2): o `401` e o cabeçalho `WWW-Authenticate` obrigatório, com pelo menos um desafio; e a [seção 8.8.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.1), por que a `ETag` não é reutilizada para outra representação.
3. [RFC 9110, seção 15.5.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.4): o `403`, a regra de não repetir com as mesmas credenciais, e o `404` permitido para «esconder» um recurso proibido.
4. [RFC 9110, seção 15.5.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.5): o `404`, «não encontrou uma representação atual ou não está disposto a revelar que ele existe».
5. [RFC 9110, seções 15.5.6 e 10.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.6): o `405` e o cabeçalho `Allow` obrigatório nele.
6. [RFC 9110, seção 9.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.1): a fronteira entre `405` (método conhecido, não admitido no recurso) e `501` (método que o servidor não implementa).
7. [RFC 9110, seções 15.5.16 e 15.5.14](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.16): o `415`, e `Accept` na resposta para dizer que tipos teriam sido aceitos; o `413`, e que o servidor pode fechar a conexão.
8. [RFC 9110, seções 11.1, 11.4 e 11.6.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-11.1): o nome do esquema de autenticação não distingue maiúsculas, a forma da credencial (`esquema` e um espaço) e a forma do desafio em `WWW-Authenticate`.
9. [RFC 9110, seção 8.3.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.1): o tipo e o subtipo de um `Content-Type` não distinguem maiúsculas; o que vem depois do `;` são parâmetros.
10. [RFC 6750, *The OAuth 2.0 Authorization Framework: Bearer Token Usage*](https://www.rfc-editor.org/rfc/rfc6750.html), seções 3 e 3.1: o esquema `Bearer`, o desafio com `realm`, o código `invalid_token` e a regra de não enviar código de erro quando a requisição não traz autenticação ou usa um esquema que não é admitido.
11. [OWASP API Security Top 10, API1:2023 *Broken Object Level Authorization*](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization): verificar em cada acesso que quem pede pode usar esse registro, e identificadores difíceis de adivinhar.
12. [OWASP Web Security Testing Guide, WSTG-IDNT-04](https://github.com/OWASP/wstg/blob/master/document/4-Web_Application_Security_Testing/03-Identity_Management/04-Account_Enumeration_and_Guessable_User_Account.md): a enumeração por diferenças entre `403` e `404`, e as respostas genéricas como defesa.
13. [Documentação da API REST do GitHub, *Troubleshooting*](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api): responde `404` e não `403` a um recurso privado, para não confirmar que ele existe.
14. [Manual do `curl`](https://curl.se/docs/manpage.html), opções `-d`, `-H`, `-X`, `-I` e `-w`: `-d` envia `application/x-www-form-urlencoded` se nenhum outro tipo for indicado, e `-w '%header{etag}'` imprime um cabeçalho da resposta.
15. [Node.js 24: HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html): `message.headers` com os nomes dos cabeçalhos em minúsculas, como `identificar` (`peticion.headers.authorization`) e `leerJson` (`peticion.headers["content-type"]`) os leem.

### Termos desta lição

| | |
|---|---|
| **autenticação** | descobrir quem faz a requisição; se falhar, `401` |
| **autorização** | decidir se quem faz a requisição pode fazer aquilo; se não, `403` |
| **`Bearer`** | esquema de autenticação do RFC 6750: quem porta a credencial é quem diz ser |
| **enumeração de recursos** | descobrir que recursos existem testando identificadores e comparando as respostas |
| **o ponto de entrada** | as perguntas pelas quais uma requisição passa, em ordem, antes de chegar a seu handler |
| **desafio** (*challenge*) | o valor de `WWW-Authenticate`: o esquema com que é preciso se autenticar e seus parâmetros |
| **papel** | o que uma credencial pode fazer: no `revisor`, leitor, escritor ou admin |
| **limite do corpo** | o tamanho máximo que uma rota aceita ler; se for ultrapassado, `413` |
| **protótipo** | o objeto do qual um objeto JavaScript herda propriedades, como `constructor` ou `toString` |

---

**Anterior:** [Lição 1 — Sucessos e redirecionamentos: 200, 201, 202, 204, 301, 308 e 304](01-exitos-redirecciones.md) · **Próxima:** [Lição 3 — O cliente errou (II): 409, 410, 412, 422 e 428](03-errores-del-cliente-estado.md)

# Lição 0 — O contrato que viaja por HTTP

São 23:40 de uma sexta-feira. O painel do `revisor` diz que os quatro serviços estão no ar: `catalogo`, `inventario`, `pagos` e `reportes`, os quatro em verde. O monitor da empresa também está verde: zero erros na última hora. E mesmo assim o chat de suporte se enche de mensagens de gente que não consegue pagar. Alguém abre um terminal, pede a `pagos` seu estado e lê a resposta completa pela primeira vez na noite. A primeira linha diz `HTTP/1.1 200 OK`. O corpo, três linhas abaixo, diz `{"error": "la base de datos no está disponible"}`. Todos os programas que vigiavam o serviço leram a primeira linha e ficaram tranquilos. Nenhum leu o corpo. O serviço estava fora do ar havia quarenta minutos, dizendo que estava bem.

Esta lição é sobre essa primeira linha: o que ela diz, quem a lê e por que ela não pode mentir.

**Tempo:** 90 min, ou 2 × 45 (a divisão está entre as seções 0.4 e 0.5)

**O que se constrói:** o ambiente do curso (Node 24 e `curl`), o primeiro servidor HTTP e o **ambiente de testes** que vai ser usado em todas as lições: um servidor que responde o código de status pedido (`GET /codigo/503`) com os cabeçalhos que esse código leva

**O que se aprende:** o que é uma resposta HTTP (linha de status, cabeçalhos, corpo); as cinco famílias de códigos; **o código manda e o corpo explica**; o que um programa faz com um código que não conhece; onde vivem os registros oficiais de códigos, cabeçalhos e tipos de problema; e por que um `200` com `{"error": …}` engana o cache, o monitor e o cliente

**Ponto de partida.** Ainda não se traz nada deste curso. Traz-se, sim, o que o [README](README.md) pede: já ter escrito alguma API, na linguagem que for, saber o que é uma requisição HTTP e o que é JSON, e ler um programa curto em TypeScript. Não é preciso conhecer nenhuma especificação: toda vez que a lição cita uma, diz que seção e o que ela diz.

**O que esta lição não faz.** Não ensina a escolher um código para uma situação concreta: isso começa na [Lição 1](01-exitos-redirecciones.md) com os sucessos e vai até a 4 com os erros. Não dá formato ao corpo dos erros: aqui o corpo é uma linha de texto, e a [Lição 5](05-problem-details.md) o troca por `application/problem+json`. E o cache que aparece na seção 0.8 é um cache **de brinquedo**, de sessenta linhas, que aplica duas regras reais das especificações; serve para ver o problema com os próprios olhos, não para ser usado em produção.

**Sobre as execuções.** O Linux Mint 22 é o sistema de referência do curso. As saídas desta lição foram obtidas em 21 de outubro de 2026 no macOS com Node 24.14.1 e curl 8.7.1, e foram repetidas por completo em um contêiner de Ubuntu 24.04.5 (a base do Linux Mint 22) com Node 24.22.0 e curl 8.5.0, o `curl` que o `apt` instala. As duas execuções deram o mesmo resultado linha por linha, exceto em três coisas, avisadas onde aparecem: a data do cabeçalho `Date` (será a do dia de quem executar), a versão do `curl` que aparece em `curl -v`, e o número do erro de «endereço já em uso» (`-48` no macOS, `-98` no Linux). Nada foi executado em uma instalação desktop do Mint. Os programas estão em [`programas/00-el-contrato-que-viaja/`](../programas/00-el-contrato-que-viaja), no repositório do curso, cada um com sua execução em um arquivo `fig00_NN.salida.txt`. Todos passam no `tsc` em modo estrito (a seção 0.9 diz como comprovar).

## Ao terminar, será possível

- Subir um servidor HTTP com Node 24 sem dependências e consultá-lo com `curl -i`, `curl -v` e `curl -I`.
- Apontar em uma resposta real a linha de status, cada cabeçalho, a linha vazia e o corpo, e dizer que parte cada programa do caminho lê.
- Dizer a família de qualquer código de três dígitos e o que um cliente deve fazer com um código que não conhece, citando a regra do RFC 9110.
- Provocar à vontade qualquer código com o ambiente de testes e comprovar com `curl` que cabeçalhos ele leva.
- Encontrar um código ou um cabeçalho no registro da IANA e contar quantos códigos há atribuídos em uma família sem cair na armadilha das linhas «Unassigned».
- Demonstrar com uma execução que um `200` com um erro no corpo passa no health check de `curl -f`, fica guardado em um cache e o impede de servir a cópia boa.

## O porquê antes do como

Uma API conversa com muitos programas que não conhecemos. O que a chamou, sim: foi escrito por nós ou por alguém da equipe, e sabe ler o nosso JSON. Mas entre esse programa e o servidor há outros que nunca leram a documentação: um balanceador que decide para que máquina mandar cada requisição, um cache que guarda respostas para não repetir trabalho, um monitor que conta erros por minuto, um health check que reinicia o serviço se ele não responder bem, e o próprio cliente HTTP de cada linguagem, que traz suas regras de fábrica. **Nenhum deles precisa entender o nosso corpo. Todos entendem o número.** (Há gateways que inspecionam o conteúdo, e clientes que de fato o leem; mas não podemos contar com eles, e o número é a única coisa que todos têm em comum.)

Por isso a primeira linha de uma resposta é um contrato. Não é um contrato assinado com uma pessoa, e sim com todo o software que já existe e que segue as mesmas especificações. Quando o servidor responde `503`, cada um desses programas sabe algo sem perguntar: o monitor conta como falha, o health check marca, o cache pode servir uma cópia anterior, o cliente sabe que o problema não é dele. Quando responde `200`, todos concluem que deu tudo certo, diga o que disser o corpo. A cena do começo não é exagerada: é o que acontece quando o número e o corpo dizem coisas diferentes, e o número vence porque é a única coisa que quase todos leem.

No `revisor`, isso se vive dos dois lados. Como **cliente**, o `revisor` consulta serviços alheios e decide se estão no ar segundo o que respondem; se um serviço mente com um `200`, o `revisor` mente junto. Como **servidor**, o `revisor` é uma API que alguém mais vai consultar, e seus erros precisam dizer a verdade no número para que seus próprios clientes, monitores e caches não se enganem.

A lição tem cinco partes, nesta ordem:

1. **O ambiente e a primeira resposta** (0.1 e 0.2): instala-se o Node 24, sobe-se um servidor de quinze linhas e olha-se o que de fato viaja.
2. **As famílias** (0.3): o primeiro dígito do código, e a pergunta que cada família responde.
3. **O ambiente de testes** (0.4): o servidor que responde o código pedido, e que vai ser usado em todo o curso.
4. **Quem lê o quê** (0.5 a 0.7): o código manda e o corpo explica; o que um programa faz com um código que não conhece; e onde está escrito que códigos existem.
5. **O estrago** (0.8): um cache, um monitor e um cliente diante de um servidor que mente e de outro que diz a verdade.

Com esse destino em mente, isto é o que vai aparecer na seção 0.8: o mesmo serviço fora do ar, através de um cache, em duas versões. Na primeira, o servidor respondeu `200` com seu erro, e o cache o guardou e o repete. Na segunda, o servidor respondeu `503`, e o cache serviu a última cópia boa:

```text
{"error":"la base de datos no está disponible"}
```

```text
{"servicios":["catalogo","pagos"]}
```

A única coisa que mudou entre as duas execuções foi o número.

## Os conceitos

### 0.1 O ambiente: Node 24, `curl` e uma pasta

#### 0.1.1 `curl`

O `curl` é o instrumento do curso: um programa de terminal que faz uma requisição HTTP e mostra o que o servidor respondeu, sem uma tela bonita que esconda nada. Ele vem primeiro porque é necessário para instalar o Node, e depois para todo o resto. Se `curl --version` não responder, instale-o:

```bash
sudo apt install curl
```

#### 0.1.2 Node 24

Os programas do curso estão em TypeScript e são executados pelo **Node.js 24**. O Node 24 tem um recurso que este curso aproveita: executa um arquivo `.ts` diretamente, **removendo os tipos** antes de rodá-lo, sem compilá-lo para JavaScript e sem instalar mais nada. A [documentação do Node 24](https://nodejs.org/docs/latest-v24.x/api/typescript.html) descreve isso assim: o Node substitui as anotações de tipo por espaços e executa o que sobra; por isso só aceita TypeScript que possa ser «apagado» sem mudar o programa. O que não pode ser apagado assim (um `enum`, um `namespace` com código, as propriedades declaradas nos parâmetros de um construtor) dá erro, e os programas do curso não usam isso. Esse recurso está ativo por padrão desde o Node 23.6, deixou de imprimir o aviso de «experimental» na 24.3 e foi declarado estável na 24.12.

Por que o Node 24 e não outro? Porque é uma linha **LTS** (*long-term support*, suporte de longo prazo). Segundo o [calendário oficial de versões do Node](https://github.com/nodejs/Release), a 24 entrou em LTS em 28 de outubro de 2025, passou para a fase de manutenção em 20 de outubro de 2026 e recebe correções até 30 de abril de 2028. A 26 será LTS a partir de 28 de outubro de 2026; os programas deste curso não usam nada que mude entre as duas.

No Linux Mint 22 não convém instalar o Node com `apt`: o Mint 22 se baseia no Ubuntu 24.04, e o pacote `nodejs` dessa base é a versão 18.19.1 (comprovado com `apt-cache policy nodejs` em um contêiner de Ubuntu 24.04), uma linha que já não recebe correções. Ele é instalado com o **nvm**, o gerenciador de versões do Node recomendado pela [página de downloads do Node](https://nodejs.org/en/download), igual ao curso de TypeScript da Hábil. A [documentação do nvm](https://github.com/nvm-sh/nvm) publica este instalador para sua versão 0.40.8, a vigente:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
```

> **Nota de segurança.** O pipe `| bash` executa na máquina, sem leitura prévia, o que esse endereço retornar. Aqui é razoável porque é o instalador oficial do `nvm`, por HTTPS e com uma versão fixa (`v0.40.8`), mas nunca faça isso com um endereço desconhecido. Para revisá-lo antes, baixe-o para um arquivo (`curl -o instalar-nvm.sh` com o mesmo endereço), leia-o e rode-o depois com `bash instalar-nvm.sh`.

Feche o terminal, abra outro (o instalador acrescenta o `nvm` ao arquivo de inicialização, e o terminal que já estava aberto não fica sabendo) e peça a linha 24:

```bash
nvm install 24
nvm alias default 24
node -v
```

`node -v` deve imprimir um número que comece com `v24`. O número seguinte depende do dia da instalação; as execuções desta lição foram feitas com a 24.14.1 e a 24.22.0, e deram o mesmo resultado.

#### 0.1.3 A pasta do curso

Todo o curso vive em uma pasta, `~/curso-http/`. Crie-a e entre nela, porque todos os comandos da lição são rodados a partir dali:

```bash
mkdir -p ~/curso-http && cd ~/curso-http
```

Coloque dentro dela um arquivo `package.json` com uma única indicação:

```json
{
  "type": "module"
}
```

Esse arquivo não instala nada; o curso não tem dependências. Ele só diz ao Node, e ao `tsc` se ele for usado, que os arquivos dessa pasta são **módulos ESM**, a forma moderna do JavaScript, a que usa `import`. Sem ele, o Node teria de adivinhar isso toda vez.

### 0.2 Uma resposta por dentro

#### 0.2.1 O primeiro servidor

Este é o menor servidor HTTP que vale a pena escrever. Salve-o como `~/curso-http/fig00_01.ts`:

```ts
// fig00_01.ts
import { createServer } from "node:http";

const servidor = createServer((peticion, respuesta) => {
  console.log(`${peticion.method} ${peticion.url}`);
  const cuerpo = "el revisor está escuchando\n";
  respuesta.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(cuerpo),
  });
  respuesta.end(cuerpo);
});

servidor.listen(18080, "127.0.0.1", () => {
  console.log("escuchando en http://127.0.0.1:18080");
});
```

Lê-se de cima para baixo. `node:http` é o módulo do Node que sabe falar HTTP; o prefixo `node:` diz que ele vem com o Node e não de um pacote externo. `createServer` recebe uma função que o Node chama **uma vez para cada requisição**, com dois objetos: a `peticion` que chegou e a `respuesta` que vai ser escrita. A função imprime o método e o caminho (para que se veja no terminal do servidor o que chegou), e depois escreve a resposta em dois passos. `writeHead` escreve o **código de status** e os **cabeçalhos**; `end` escreve o **corpo** e fecha a resposta.

Dois cabeçalhos, os dois com um motivo. `Content-Type` diz o que é o corpo: texto puro em UTF-8. `Content-Length` diz quantos **bytes** ele mede, e por isso é calculado com `Buffer.byteLength` e não com `cuerpo.length`: o «á» de «está» ocupa dois bytes em UTF-8, e o corpo mede 28 bytes embora tenha 27 caracteres. No final, `listen` abre a porta 18080 em `127.0.0.1`, que é o nome de «este mesmo computador»: ninguém de fora da máquina consegue chegar a este servidor, e assim deve ser enquanto se pratica.

Rode-o em um terminal, que vai ficar aberto:

```text
$ node fig00_01.ts
escuchando en http://127.0.0.1:18080
```

O programa não termina: fica esperando requisições até ser interrompido com `Ctrl`+`C`.

#### 0.2.2 O que viaja: `curl -i`

Em **outro** terminal, peça algo a ele. A opção `-i` diz ao `curl` para mostrar a resposta completa, com sua linha de status e seus cabeçalhos, e não só o corpo:

```text
$ curl -i http://127.0.0.1:18080/
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 28
Date: Wed, 21 Oct 2026 07:27:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el revisor está escuchando
```

Isto é uma resposta HTTP, e ela tem três partes, sempre na mesma ordem:

| Parte | Na execução | Quem a escreveu |
|---|---|---|
| **Linha de status** | `HTTP/1.1 200 OK` | nós, com o `200` de `writeHead`; o Node acrescentou a versão e o `OK` |
| **Cabeçalhos** | de `Content-Type` a `Keep-Alive` | escrevemos dois; o Node acrescentou `Date`, `Connection` e `Keep-Alive` |
| **Corpo** | `el revisor está escuchando` | nós, com `end` |

Entre os cabeçalhos e o corpo há **uma linha vazia**. Não é decoração: é a única forma de quem lê saber onde terminam os cabeçalhos. E o corpo termina onde `Content-Length` diz: 28 bytes, nem um a mais. A especificação que define essa forma exata, linha por linha, é o [RFC 9112](https://www.rfc-editor.org/rfc/rfc9112.html), que descreve o HTTP/1.1 tal como viaja pela rede. O que os códigos e os cabeçalhos **significam** está em outro documento, o [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), *HTTP Semantics*, que é o mais citado neste curso. A separação faz sentido: o HTTP/2 e o HTTP/3 viajam de outra forma, com outro formato binário, mas os códigos e os cabeçalhos significam o mesmo nas três versões.

Olhe agora a linha de status com calma. Ela tem três peças: a versão (`HTTP/1.1`), o código (`200`) e uma frase (`OK`). A frase se chama *reason phrase*, e o RFC 9112, em sua [seção 4](https://www.rfc-editor.org/rfc/rfc9112.html#section-4), diz algo que convém lembrar desde hoje: um cliente **deveria ignorá-la**, porque ela não é um canal de informação confiável; pode vir traduzida, pode ser mudada por um intermediário ou pode desaparecer ao passar para outra versão do HTTP. A frase é para a pessoa que lê o terminal. Para os programas, a única coisa que conta é o número. Na seção 0.5 vai aparecer que até o Node usa frases diferentes das oficiais para alguns códigos.

> **Nota sobre o nome da opção.** Nas versões recentes do `curl`, a opção longa de `-i` se chama `--show-headers` (antes se chamava `--include`, e o nome antigo continua funcionando), segundo o [manual do `curl`](https://curl.se/docs/manpage.html). `-i` funciona igual nas duas.

#### 0.2.3 A requisição também tem forma: `curl -v`

Uma conversa HTTP tem duas metades, e `-i` só mostra a segunda. Com `-v` (*verbose*, «com todos os detalhes»), o `curl` mostra também o que **enviou**:

```text
$ curl -v http://127.0.0.1:18080/servicios
*   Trying 127.0.0.1:18080...
* Connected to 127.0.0.1 (127.0.0.1) port 18080
> GET /servicios HTTP/1.1
> Host: 127.0.0.1:18080
> User-Agent: curl/8.7.1
> Accept: */*
> 
* Request completely sent off
< HTTP/1.1 200 OK
< Content-Type: text/plain; charset=utf-8
< Content-Length: 28
< Date: Wed, 21 Oct 2026 07:27:41 GMT
< Connection: keep-alive
< Keep-Alive: timeout=5
< 
el revisor está escuchando
* Connection #0 to host 127.0.0.1 left intact
```

As linhas com `*` são comentários do `curl` sobre a conexão. As que começam com `>` são a **requisição**, tal como saiu: uma linha com o **método** (`GET`), o **caminho** (`/servicios`) e a versão, e depois seus próprios cabeçalhos. As que começam com `<` são a resposta, a mesma de antes. (No Linux aparece `curl/8.5.0` em `User-Agent`, ou a versão instalada; é a única coisa que muda.)

Repare em duas coisas. A primeira: a requisição tem a mesma forma que a resposta, uma linha inicial, cabeçalhos, uma linha vazia e, se for preciso, um corpo. A segunda: foi pedido `/servicios` e o servidor respondeu `200` com o mesmo texto de sempre, porque este servidor não olha o caminho; só o imprime. No terminal dele apareceu `GET /servicios`. Um servidor que responde `200` a um caminho que não existe já é uma pequena mentira, e o ambiente de testes da seção 0.4 não a comete.

#### 0.2.4 Só os cabeçalhos: `HEAD` e `curl -I`

Há um método que existe para perguntar por uma resposta sem recebê-la: `HEAD`. O servidor responde exatamente o que responderia a um `GET`, cabeçalhos incluídos, mas sem corpo. `curl -I` envia um `HEAD`:

```text
$ curl -I http://127.0.0.1:18080/
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 28
Date: Wed, 21 Oct 2026 07:27:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

```

`Content-Length` continua dizendo 28, porque diz quanto mediria o corpo de um `GET`, mas nenhum corpo chegou. O programa não fez nada especial para isso: escreveu o corpo com `end`, e o Node, que sabe que a requisição era `HEAD`, não o enviou. No terminal do servidor apareceu `HEAD /`. Os health checks e alguns monitores usam `HEAD` justamente porque só o número importa para eles, e o número chega do mesmo jeito.

Já dá para parar o servidor com `Ctrl`+`C`. O resto da lição usa a porta 18080 para outros programas.

### 0.3 Cinco famílias e uma pergunta

O código de status é um número de três dígitos, e **o primeiro dígito é a família**. O RFC 9110 define cinco em sua [seção 15](https://www.rfc-editor.org/rfc/rfc9110.html#section-15), e cada uma responde a uma pergunta diferente:

| Família | O que o RFC 9110 diz | A pergunta que ela responde |
|---|---|---|
| `1xx` | a requisição foi recebida e o processo continua | continuo esperando? Sim: esta não é a resposta final |
| `2xx` | a requisição foi recebida, entendida e aceita | deu certo? Sim |
| `3xx` | é preciso outra ação para concluí-la | onde está? Em outro lugar, e digo onde |
| `4xx` | a requisição tem um erro ou não pode ser atendida | quem errou? Quem pediu |
| `5xx` | o servidor falhou com uma requisição aparentemente válida | quem errou? Quem atende |

A família `1xx` é diferente das outras quatro, e convém saber disso desde hoje. Uma resposta `1xx` é **intermediária**: segundo a [seção 15.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.2), uma requisição pode receber zero ou mais respostas `1xx` e depois **exatamente uma** resposta final das outras famílias. Uma `1xx` não pode levar corpo, e nunca é a palavra final. Por isso o ambiente de testes da próxima seção se recusa a produzir uma como resposta final.

A pergunta da última coluna é a mais útil do curso, e as lições 2 a 4 a transformam em um método. Quando chega um erro, antes de ler qualquer outra coisa, olhe o primeiro dígito. Um `4` diz que quem precisa mudar algo é quem fez a requisição: a entrada, a identidade, a permissão. Um `5` diz que a requisição estava certa e o servidor falhou, e que quem a fez não tem nada a corrigir, embora isso não o autorize a repeti-la às cegas (a [Lição 6](06-reintentos-idempotencia.md) trata de quando pode). Para ver esta mesma tabela aplicada a uma API de contatos, com um servidor que mente e outro que não mente lado a lado, a primeira edição da série «HTTP y Problem Details» do boletim da Hábil, citada no final, a percorre código por código.

### 0.4 O ambiente de testes

#### 0.4.1 Para que serve

Para aprender o que um programa faz com um `503`, é preciso um servidor que responda `503` quando quisermos. Esperar que um serviço real caia não é um método, e provocar isso em um serviço alheio não é correto. O ambiente de testes resolve isso: é um servidor que responde, no caminho `/codigo/NNN`, o código `NNN` pedido, com os cabeçalhos que esse código exige ou costuma levar. Ele vai ser usado em todas as lições do curso, e por isso vale a pena lê-lo com cuidado uma vez.

#### 0.4.2 O programa

Salve-o como `~/curso-http/fig00_02.ts`:

```ts
// fig00_02.ts
// El banco de pruebas del curso: responde el código que le pidas en /codigo/NNN.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const PUERTO = 18080;

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
  console.log(`banco de pruebas en http://127.0.0.1:${PUERTO}/codigo/NNN`);
});
```

O programa tem três peças.

**Duas tabelas.** `NOMBRES` guarda a frase oficial dos 28 códigos que o curso usa (os 23 protagonistas e os cinco que aparecem de passagem), copiada do registro da IANA, que é a lista oficial de códigos (seção 0.7). `CABECERAS` guarda os cabeçalhos que cada código leva. Nem todos têm o mesmo peso, e convém dizer isso com precisão: o RFC 9110 diz que um `401` **deve** levar `WWW-Authenticate` com pelo menos um desafio ([seção 15.5.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.2)) e que um `405` **deve** levar `Allow` com os métodos permitidos ([seção 15.5.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.6)). Para os redirecionamentos (`301`, `302`, `307`, `308`), o servidor **deveria** enviar `Location`. Para o `201`, `Location` identifica o recurso criado e, se faltar, o recurso criado é o próprio caminho da requisição ([seção 15.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.2)). E `Retry-After` em um `503` é **opcional** segundo o RFC 9110, igual a um `429` segundo o [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html), que é onde esse código foi definido. As lições 1 a 4 explicam cada um a fundo; o ambiente de testes só permite vê-los.

**A função `enviar`.** Monta o corpo, uma linha com o código e seu nome e outra com a explicação, e escreve a resposta. Há dois detalhes. O primeiro: para `204`, `205` e `304` não escreve corpo nem `Content-Type`, porque esses três códigos não podem levá-lo: o RFC 9112 ([seção 6.3](https://www.rfc-editor.org/rfc/rfc9112.html#section-6.3)) diz que uma resposta `204` ou `304` termina na primeira linha vazia depois dos cabeçalhos, e o RFC 9110 ([seção 15.3.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.6)) proíbe gerar conteúdo em um `205`. A lista não é a regra inteira. Um `1xx` também não pode levar corpo, mas o ambiente de testes já se recusa a produzir um (visto em 0.3 e que se verá em 0.4.4); e uma resposta a `HEAD` nunca leva corpo, e disso o Node se encarrega (0.2.4). Um `205` é raro (pede ao navegador que limpe o formulário que enviou), mas o ambiente de testes pode produzi-lo quando solicitado, e por isso está na lista. O segundo: se o código está em `NOMBRES`, passa a `writeHead` a frase oficial; se não, deixa o Node colocar a sua. A [documentação de `writeHead`](https://nodejs.org/docs/latest-v24.x/api/http.html) aceita os três argumentos: o código, a frase (opcional) e os cabeçalhos.

**A função `atender`.** É o ponto de entrada, e verifica em ordem. Primeiro o método: o ambiente de testes só sabe responder `GET` e `HEAD`, e a qualquer outro responde `405` com seu `Allow`; ou seja, ele cumpre a regra que ensina. Depois o caminho: precisa ser `/codigo/` seguido de exatamente três dígitos, ou ele responde `404` e diz qual é o único caminho que existe. E por fim o número: menos de 100 não existe, um `1xx` não pode ser a resposta final, e mais de 599 é inválido segundo a especificação, mas o ambiente de testes o produz mesmo assim, de propósito, porque na seção 0.6 vai ser preciso ver o que um cliente faz com um código que não deveria existir.

#### 0.4.3 Testá-lo

Rode-o em um terminal e deixe-o aberto:

```text
$ node fig00_02.ts
banco de pruebas en http://127.0.0.1:18080/codigo/NNN
```

Em outro terminal, peça um serviço fora do ar:

```text
$ curl -i http://127.0.0.1:18080/codigo/503
HTTP/1.1 503 Service Unavailable
Retry-After: 120
Content-Type: text/plain; charset=utf-8
Content-Length: 50
Date: Tue, 27 Oct 2026 10:26:22 GMT
Connection: keep-alive
Keep-Alive: timeout=5

503 Service Unavailable
lo pediste en /codigo/503
```

O código, sua frase, o cabeçalho `Retry-After` («tente de novo em 120 segundos») e um corpo que explica. Um recurso criado:

```text
$ curl -i http://127.0.0.1:18080/codigo/201
HTTP/1.1 201 Created
Location: /servicios/demo
Content-Type: text/plain; charset=utf-8
Content-Length: 38
Date: Tue, 27 Oct 2026 10:26:22 GMT
Connection: keep-alive
Keep-Alive: timeout=5

201 Created
lo pediste en /codigo/201
```

Uma resposta sem conteúdo, que não traz corpo nem `Content-Type`, porque não há nada a descrever:

```text
$ curl -i http://127.0.0.1:18080/codigo/204
HTTP/1.1 204 No Content
Date: Tue, 27 Oct 2026 10:26:22 GMT
Connection: keep-alive
Keep-Alive: timeout=5

```

O `205` é do mesmo tipo: sem corpo, porque o RFC 9110 ([seção 15.3.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.6)) proíbe gerar conteúdo em um `205`. Mas ele traz um cabeçalho que o `204` não traz, e há uma razão para isso. O RFC 9112 ([seção 6.3](https://www.rfc-editor.org/rfc/rfc9112.html#section-6.3)) diz que uma resposta `204` ou `304` termina na primeira linha vazia, e o `205` não está nessa regra: sem `Content-Length` nem `Transfer-Encoding`, seu corpo só terminaria quando a conexão fosse fechada. Se o programa não declarasse nada, o Node mandaria o `205` em pedaços (a forma que 0.8.2 explica), com um único pedaço final de tamanho zero. Por isso `enviar` coloca nele `Content-Length: 0`: diz onde a resposta termina sem mandar conteúdo, e não há pedaços:

```text
$ curl -i http://127.0.0.1:18080/codigo/205
HTTP/1.1 205 Reset Content
Content-Length: 0
Date: Tue, 27 Oct 2026 10:26:22 GMT
Connection: keep-alive
Keep-Alive: timeout=5

```

Uma falta de identidade, com o desafio que a especificação exige:

```text
$ curl -i http://127.0.0.1:18080/codigo/401
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: text/plain; charset=utf-8
Content-Length: 43
Date: Tue, 27 Oct 2026 10:26:22 GMT
Connection: keep-alive
Keep-Alive: timeout=5

401 Unauthorized
lo pediste en /codigo/401
```

#### 0.4.4 As três verificações de entrada do ambiente de testes

Agora as três validações de `atender`, para mostrar que o próprio ambiente de testes também diz a verdade quando quem erra é quem pede. Um método que ele não atende (`-X DELETE` diz ao `curl` que método usar):

```text
$ curl -i -X DELETE http://127.0.0.1:18080/codigo/200
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD
Content-Type: text/plain; charset=utf-8
Content-Length: 56
Date: Tue, 27 Oct 2026 10:26:22 GMT
Connection: keep-alive
Keep-Alive: timeout=5

405 Method Not Allowed
el banco solo atiende GET y HEAD
```

Um caminho que não existe:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 68
Date: Tue, 27 Oct 2026 10:26:22 GMT
Connection: keep-alive
Keep-Alive: timeout=5

404 Not Found
la única ruta es /codigo/NNN; prueba con /codigo/503
```

E um `1xx` pedido como resposta final:

```text
$ curl -i http://127.0.0.1:18080/codigo/103
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 76
Date: Tue, 27 Oct 2026 10:26:22 GMT
Connection: keep-alive
Keep-Alive: timeout=5

400 Bad Request
un 1xx es una respuesta intermedia: no puede ser la última
```

Cada requisição ficou anotada no terminal do ambiente de testes (`GET /codigo/503`, `DELETE /codigo/200`…). Deixe-o rodando: ele é necessário nas duas seções seguintes.

### 0.5 O código manda e o corpo explica

#### 0.5.1 Quem lê o número

Este é o primeiro dos três princípios do curso, e dá para vê-lo com uma ferramenta que provavelmente já está em algum script: `curl -f`. Com `-f` (*fail*), o `curl` deixa de ser um instrumento para olhar e passa a ser um instrumento para **decidir**: se o código é `400` ou maior, não imprime o corpo e termina com o código de saída 22. O [manual do `curl`](https://curl.se/docs/manpage.html) o define assim: o código 22 significa que a página não foi obtida porque o servidor respondeu um código de 400 ou mais, e só aparece com `--fail`. Muitos health checks são exatamente isso, um `curl -f` cujo código de saída decide se o serviço está bem. `echo $?` mostra o código de saída do último comando:

```text
$ curl -f http://127.0.0.1:18080/codigo/200
200 OK
lo pediste en /codigo/200
$ echo $?
0
$ curl -f http://127.0.0.1:18080/codigo/503
curl: (22) The requested URL returned error: 503
$ echo $?
22
```

`curl -f` não leu o corpo em momento algum. Não tinha como saber que «lo pediste en /codigo/503» não é uma explicação muito útil; nem se importa. Decidiu com o número, e com mais nada.

O cliente HTTP do JavaScript faz o mesmo. Ao usar `fetch`, a resposta tem uma propriedade `ok`, e o [padrão Fetch](https://fetch.spec.whatwg.org/) a define em uma frase: um status *ok* é um status entre 200 e 299, inclusive. Meio mundo escreve `if (respuesta.ok)` e segue em frente. Se o servidor respondeu `200` com `{"error": …}` dentro, esse `if` entra no ramo errado, e nenhum programa do caminho vai perceber. A seção 0.6 usa `fetch` contra o ambiente de testes, e a 0.8 faz a conta completa do estrago.

Por isso o princípio tem duas metades. **O código manda:** é a parte da mensagem que todos leem, e a que decide o que eles fazem. **O corpo explica:** é para quem precisa do detalhe, uma pessoa ou um programa que entende o formato da API. E a condição que une as duas é a que se rompe na cena do começo: **os dois dizem a mesma coisa**. Um corpo pode acrescentar informação ao código, mas nunca contradizê-lo nem substituí-lo. O RFC 9110 pede isso para as duas famílias de erros: em um `4xx` e em um `5xx`, exceto quando a requisição é `HEAD`, o servidor **deveria** enviar no corpo uma explicação do erro e dizer se ele é temporário ou permanente ([seções 15.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5) e [15.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6)). Ou seja: o número **e também** a explicação, não um no lugar do outro.

#### 0.5.2 A frase da linha de status não é a mensagem

Em 0.2.2 viu-se que um cliente deveria ignorar a frase da linha de status. Aqui está a prova do porquê. O ambiente de testes usa as frases do registro oficial para seus 28 códigos, mas para qualquer outro deixa o Node colocar a sua. Peça a ele um `418`, que não está em sua tabela, só os cabeçalhos:

```text
$ curl -I http://127.0.0.1:18080/codigo/418
HTTP/1.1 418 I'm a Teapot
Content-Type: text/plain; charset=utf-8
Content-Length: 57
Date: Tue, 27 Oct 2026 10:26:22 GMT
Connection: keep-alive
Keep-Alive: timeout=5

```

O Node o chama de «I'm a Teapot», «sou um bule de chá», que vem de uma piada: o [RFC 2324](https://www.rfc-editor.org/rfc/rfc2324.html), publicado em 1º de abril de 1998, que zombava dos abusos do HTTP. No registro oficial, o `418` aparece como **(Unused)**, e a [seção 15.5.19 do RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.19) explica por quê: foi usado como piada tantas vezes que já não serve para nenhum uso sério, então ficou reservado. E não é o único caso: a tabela de frases que o Node traz chama o `422` de «Unprocessable Entity» e o `413` de «Payload Too Large», que eram os nomes antigos; o RFC 9110 os mudou para «Unprocessable Content» e «Content Too Large», e é assim que aparecem no registro. Por isso o ambiente de testes traz sua própria tabela.

Nenhuma dessas diferenças quebra nada, e essa é a lição: **a frase pode dizer qualquer coisa, e nenhum programa deve decidir com ela**. Um cliente que compara a frase com `"Not Found"` para de funcionar com o primeiro servidor que a traduz, a abrevia ou a omite. O número é o mesmo em todos.

### 0.6 Um código que a máquina não conhece

#### 0.6.1 A regra

Há mais de sessenta códigos atribuídos (seção 0.7), e de vez em quando aparecem novos. Nenhum programa conhece todos, e a especificação sabe disso. O RFC 9110, na introdução de sua [seção 15](https://www.rfc-editor.org/rfc/rfc9110.html#section-15), dá uma regra curta que vale saber de cor: um cliente não é obrigado a entender todos os códigos registrados, mas **deve** entender a família de qualquer código pelo primeiro dígito, e **deve** tratar um código que não reconhece como o `x00` de sua família. O próprio RFC dá o exemplo: se chega um `471`, que ele não conhece, o primeiro dígito diz que algo estava errado na requisição, e o cliente o trata como se tivesse recebido um `400`.

A mesma seção acrescenta uma segunda regra: os valores fora da faixa de 100 a 599 são **inválidos**. Algumas bibliotecas usam números como 600 ou 999 para comunicar erros internos que não são de HTTP, e se um desses chega a um cliente, o cliente **deveria** tratá-lo como um `5xx`. É uma decisão sensata: um número que não deveria existir diz, sobretudo, que algo do lado do servidor está errado.

Com essas duas regras, um programa que só conhece um punhado de códigos pode reagir com sentido a qualquer um. E por isso inventar códigos próprios é má ideia (o curso não ensina isso, de propósito): o nosso `299 Casi listo` ninguém mais entende, e todos vão tratá-lo como um `200` comum.

#### 0.6.2 O leitor que só olha o número

Este programa lê as respostas do ambiente de testes como um monitor faria: não olha o corpo, só o número, e aplica as duas regras. Salve-o como `~/curso-http/fig00_03.ts`:

```ts
// fig00_03.ts
// Lee solo el número, como lo hace un monitor o un balanceador.

// Los códigos que este lector conoce por su nombre: los del curso.
const CONOCIDOS = new Set([
  200, 201, 202, 204, 301, 302, 304, 307, 308,
  400, 401, 403, 404, 405, 406, 409, 410, 412, 413, 415, 422, 428, 429,
  500, 501, 502, 503, 504,
]);

const FAMILIAS = ["", "informativa", "éxito", "redirección", "error del cliente", "error del servidor"];

// La regla de la sección 15 del RFC 9110.
function comoSiFuera(codigo: number): number {
  if (codigo < 100 || codigo > 599) return 500; // inválido: se trata como un 5xx
  if (CONOCIDOS.has(codigo)) return codigo; // conocido: se trata como lo que es
  return Math.floor(codigo / 100) * 100; // desconocido: el x00 de su familia
}

for (const pedido of [200, 204, 299, 308, 404, 471, 503, 600]) {
  const respuesta = await fetch(`http://127.0.0.1:18080/codigo/${pedido}`, { redirect: "manual" });
  await respuesta.text();
  const trato = comoSiFuera(respuesta.status);
  const familia = FAMILIAS[Math.floor(trato / 100)];
  console.log(`${respuesta.status}  ok=${String(respuesta.ok).padEnd(5)}  se trata como ${trato} (${familia})`);
}
```

A função `comoSiFuera` é a regra escrita em três linhas, na ordem em que deve ser aplicada: primeiro o inválido, depois o conhecido, e por fim o desconhecido, que é arredondado para o `x00` de sua família com `Math.floor(codigo / 100) * 100`. O laço pede ao ambiente de testes oito códigos, entre eles dois que ninguém registrou (`299` e `471`) e um inválido (`600`). Dois detalhes do `fetch`: `redirect: "manual"` diz a ele para não seguir o `Location` do `308` (por padrão ele seguiria e chegaria o `200` do destino, não o `308`), e `await respuesta.text()` lê o corpo e o descarta, para que a conexão fique livre. O `await` do laço funciona fora de uma função porque o arquivo é um módulo, graças ao `package.json` de 0.1.3.

Com o ambiente de testes rodando, no outro terminal:

```text
$ node fig00_03.ts
200  ok=true   se trata como 200 (éxito)
204  ok=true   se trata como 204 (éxito)
299  ok=true   se trata como 200 (éxito)
308  ok=false  se trata como 308 (redirección)
404  ok=false  se trata como 404 (error del cliente)
471  ok=false  se trata como 400 (error del cliente)
503  ok=false  se trata como 503 (error del servidor)
600  ok=false  se trata como 500 (error del servidor)
```

Leia a coluna de `ok` e a da direita juntas. O `299` é *ok* para o `fetch`, porque está entre 200 e 299, e o leitor o trata como um `200`: um código inventado na família do sucesso é lido como sucesso, que é exatamente o que a regra diz. O `471` é lido como um `400`, o exemplo do próprio RFC. E o `600`, que o ambiente de testes produziu de propósito, é lido como um erro do servidor. Repare também que o `308` não é *ok*: `ok` só cobre a família `2xx`, e um redirecionamento ainda não é um sucesso. Um programa que faz `if (!respuesta.ok) reportarFalla()` sem olhar mais nada vai reportar como falha cada redirecionamento; é o tipo de detalhe que a [Lição 7](07-quien-lee-el-error.md) transforma em uma tabela de decisão.

Já dá para parar o ambiente de testes com `Ctrl`+`C`.

### 0.7 Os registros oficiais

#### 0.7.1 Quem decide que códigos existem

Nem o Node, nem o `curl`, nem este curso decidem que códigos existem. Quem decide é um processo público. O RFC 9110, em sua [seção 16.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-16.2.1), estabelece que os códigos são registrados no **registro de códigos de status do HTTP** mantido pela **IANA** (*Internet Assigned Numbers Authority*, o órgão que administra os números e nomes oficiais dos protocolos da internet). Cada registro tem três informações: o código, uma descrição curta e a referência à especificação que o define. E acrescentar um código novo exige uma revisão da IETF, o grupo que escreve os padrões da internet; não basta alguém usá-lo.

O [registro](https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml) pode ser baixado como CSV, e foi contado em 21 de outubro de 2026, em sua versão atualizada em 15 de setembro de 2025: há **62 códigos atribuídos**. Por família: 5 em `1xx`, 10 em `2xx`, 8 em `3xx`, 28 em `4xx` e 11 em `5xx`. Além disso há dois números reservados sem uso, o `306` e o `418`, e faixas inteiras sem atribuição. Um dos 62 é temporário: o `104`, registrado enquanto se conclui o rascunho que o define, com data de vencimento em novembro de 2026. O curso usa 23 dos 62, e o exercício 3 pede para repetir a contagem da família `4xx` com as próprias mãos, porque ela tem uma armadilha.

#### 0.7.2 Os outros três registros que vão ser usados

Os códigos não são a única coisa registrada. Ao longo do curso vão ser consultados outros três registros da IANA, e convém saber hoje que eles existem:

| Registro | O que guarda | Onde aparece no curso |
|---|---|---|
| [Nomes de campos do HTTP](https://www.iana.org/assignments/http-fields/http-fields.xhtml) | cada cabeçalho, com seu estado (permanente, provisório, obsoleto) e a especificação que o define | `Location`, `Allow`, `Retry-After` ou `WWW-Authenticate`, em cada lição |
| Tipos de mídia | os valores válidos de `Content-Type`, como `application/json` ou `application/problem+json` | Lição 5 |
| [Tipos de problema do HTTP](https://www.iana.org/assignments/http-problem-types/http-problem-types.xhtml) | identificadores padrão para o campo `type` de um *Problem Details* | Lição 5 |

O registro de cabeçalhos foi baixado no mesmo dia: tem 260 nomes, e nem todos estão vigentes; 39 estão marcados como obsoletos e 8 como descontinuados, de modo que «está no registro» não significa «deve ser usado». O de tipos de problema é muito menor: foi criado pelo [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html), a especificação dos *Problem Details* que a Lição 5 ensina por completo, e hoje tem seis entradas, a primeira delas `about:blank`.

Uma nota sobre o princípio: quando uma lição disser que um código «significa» algo ou que um cabeçalho «exige» algo, a fonte é uma destas especificações, com link na seção de fontes da lição, e o registro da IANA é o árbitro do que existe. Quando o curso tomar uma decisão que a especificação deixa em aberto (como `400` versus `422`), ele vai dizer: é princípio de design, não norma.

### 0.8 Por que um `200` com `{"error": …}` quebra o cache, o monitor e o cliente

#### 0.8.1 O experimento

Já se viu separadamente que `curl -f` e `fetch` decidem com o número. Falta o terceiro leitor do caminho, o que mais causa estrago quando erra porque erra **para todos**: o cache. Um **cache compartilhado** é um programa entre os clientes e o servidor que guarda respostas e as repete, para que o servidor não calcule mil vezes a mesma coisa. As regras de quando ele pode guardar algo estão no [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html), e duas importam aqui.

A primeira regra é da [seção 3 do RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html#section-3): um cache pode guardar uma resposta, entre outras condições, se a resposta autorizar isso explicitamente, por exemplo com `Cache-Control: max-age=N` («reutilize-me por N segundos»). A segunda é de uma extensão, o [RFC 5861](https://www.rfc-editor.org/rfc/rfc5861.html#section-4): com `stale-if-error=N`, o servidor autoriza o cache a continuar servindo uma cópia vencida por N segundos **se, ao pedir uma nova, encontrar um erro**. E o RFC define «erro» com uma lista fechada: qualquer situação que resulte em um `500`, `502`, `503` ou `504`. O cache reconhece o erro pelo número. Se o número diz `200`, para o cache não houve erro.

Este programa coloca as duas peças lado a lado: uma **origem** que pode estar saudável, mentir ou dizer a verdade, e um cache de brinquedo na frente que aplica essas duas regras, e só elas. Salve-o como `~/curso-http/fig00_04.ts`:

```ts
// fig00_04.ts
// Un origen que puede estar sano, mentir o decir la verdad, y una caché de juguete delante.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

type Modo = "sano" | "mentiroso" | "honesto";
let modo: Modo = "sano";

// ---------- El origen, en el puerto 18081 ----------

function origen(peticion: IncomingMessage, respuesta: ServerResponse): void {
  const cambio = /^\/modo\/(sano|mentiroso|honesto)$/.exec(peticion.url ?? "");
  if (peticion.method === "PUT" && cambio !== null) {
    modo = cambio[1] as Modo;
    console.log(`origen: ahora estoy ${modo}`);
    respuesta.writeHead(204).end();
    return;
  }
  if (modo === "honesto") {
    respuesta.writeHead(503, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Retry-After": "120",
    });
    respuesta.end("la base de datos no está disponible\n");
    return;
  }
  const cuerpo = modo === "sano"
    ? '{"servicios":["catalogo","pagos"]}\n'
    : '{"error":"la base de datos no está disponible"}\n';
  // Esta ruta declara que sus respuestas se pueden reutilizar 5 segundos.
  respuesta.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "max-age=5, stale-if-error=600",
  });
  respuesta.end(cuerpo);
}

// ---------- La caché, en el puerto 18080 ----------

type Copia = { cuerpo: string; tipo: string; guardadaEn: number; maxAge: number; staleIfError: number };
let copia: Copia | undefined;

// Los únicos códigos que stale-if-error considera un error (RFC 5861, sección 4).
const ERRORES = new Set([500, 502, 503, 504]);

function directiva(cacheControl: string, nombre: string): number | undefined {
  const encontrada = new RegExp(`${nombre}=(\\d+)`).exec(cacheControl);
  return encontrada === null ? undefined : Number(encontrada[1]);
}

function servirCopia(respuesta: ServerResponse, guardada: Copia, edad: number): void {
  respuesta.writeHead(200, { "Content-Type": guardada.tipo, Age: String(Math.floor(edad)) });
  respuesta.end(guardada.cuerpo);
}

async function cache(_peticion: IncomingMessage, respuesta: ServerResponse): Promise<void> {
  const edad = copia === undefined ? Infinity : (Date.now() - copia.guardadaEn) / 1000;
  if (copia !== undefined && edad < copia.maxAge) {
    console.log("caché: tengo una copia fresca; no le pregunto al origen");
    servirCopia(respuesta, copia, edad);
    return;
  }
  const delOrigen = await fetch("http://127.0.0.1:18081/servicios");
  const cuerpo = await delOrigen.text();
  const cacheControl = delOrigen.headers.get("cache-control") ?? "";
  if (ERRORES.has(delOrigen.status) && copia !== undefined && edad < copia.maxAge + copia.staleIfError) {
    console.log(`caché: el origen respondió ${delOrigen.status}; sirvo la copia anterior`);
    servirCopia(respuesta, copia, edad);
    return;
  }
  const maxAge = directiva(cacheControl, "max-age");
  if (delOrigen.status === 200 && maxAge !== undefined) {
    copia = {
      cuerpo,
      tipo: delOrigen.headers.get("content-type") ?? "application/octet-stream",
      guardadaEn: Date.now(),
      maxAge,
      staleIfError: directiva(cacheControl, "stale-if-error") ?? 0,
    };
    console.log(`caché: guardé la respuesta 200 por ${maxAge} s`);
  } else {
    console.log(`caché: el origen respondió ${delOrigen.status}; no la guardo`);
  }
  const cabeceras: Record<string, string> = {};
  for (const nombre of ["content-type", "cache-control", "retry-after"]) {
    const valor = delOrigen.headers.get(nombre);
    if (valor !== null) cabeceras[nombre] = valor;
  }
  respuesta.writeHead(delOrigen.status, cabeceras);
  respuesta.end(cuerpo);
}

createServer(origen).listen(18081, "127.0.0.1", () => {
  console.log("origen en http://127.0.0.1:18081 (PUT /modo/sano|mentiroso|honesto)");
});
createServer((peticion, respuesta) => void cache(peticion, respuesta)).listen(18080, "127.0.0.1", () => {
  console.log("caché en http://127.0.0.1:18080/servicios");
});
```

A **origem** tem um ponto de controle, `PUT /modo/...`, para mudar de humor sem ser reiniciada, e a qualquer outra requisição, com o método e o caminho que forem, responde segundo seu modo. Esse ponto de controle é um interruptor de laboratório: não pede identidade, então qualquer um que chegue à porta pode derrubar o serviço; aqui isso não importa porque ela escuta só em `127.0.0.1`, mas uma rota para injetar falhas nunca deve existir em um serviço real. Saudável, responde `200` com a lista. Mentirosa, responde `200` com um erro no corpo, **com os mesmos cabeçalhos de cache**: é o realista, porque esses cabeçalhos costumam estar configurados para a rota inteira, não para cada resposta. Honesta, responde `503` com `Retry-After` e `Cache-Control: no-store` («não guarde isto»).

O **cache** faz quatro coisas, nesta ordem. Se tem uma cópia que ainda não cumpriu seus `max-age` segundos, serve-a sem perguntar à origem. Se não, pergunta à origem. Se a origem respondeu um dos quatro erros da lista e a cópia vencida ainda está dentro de sua janela de `stale-if-error`, serve a cópia antiga. E se a origem respondeu `200` com `max-age`, guarda a resposta nova **no lugar** da anterior. Quando serve uma cópia, acrescenta o cabeçalho `Age`, os segundos que ela está guardada, que é o cabeçalho padrão para isso segundo a [seção 5.1 do RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.1). Um cache de verdade aplica muitas outras regras; este aplica duas, e é suficiente para ver o problema. Os `max-age` de 5 segundos são curtos de propósito, para que o experimento não demore; em um serviço real seriam minutos.

#### 0.8.2 Primeira execução: a origem mente

Rode-o em um terminal. Em outro, peça a lista através do cache, faça a origem começar a mentir, espere a cópia vencer (`sleep 6`) e peça de novo duas vezes:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
content-type: application/json
cache-control: max-age=5, stale-if-error=600
Date: Wed, 21 Oct 2026 07:28:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"servicios":["catalogo","pagos"]}
$ curl -X PUT http://127.0.0.1:18081/modo/mentiroso
$ sleep 6
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
content-type: application/json
cache-control: max-age=5, stale-if-error=600
Date: Wed, 21 Oct 2026 07:28:33 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"error":"la base de datos no está disponible"}
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
Content-Type: application/json
Age: 0
Date: Wed, 21 Oct 2026 07:28:33 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"error":"la base de datos no está disponible"}
```

E isto foi o que o programa escreveu em seu terminal:

```text
origen en http://127.0.0.1:18081 (PUT /modo/sano|mentiroso|honesto)
caché en http://127.0.0.1:18080/servicios
caché: guardé la respuesta 200 por 5 s
origen: ahora estoy mentiroso
caché: guardé la respuesta 200 por 5 s
caché: tengo una copia fresca; no le pregunto al origen
```

Siga a história linha por linha. A primeira requisição encontrou o cache vazio, perguntou à origem saudável e guardou a lista. Depois que a cópia venceu, o cache perguntou de novo, a origem respondeu `200` com seu erro, e o cache fez o correto segundo o que viu: um `200` com `max-age` é uma resposta boa e reutilizável, então **ele a guardou por cima da cópia boa**. A terceira requisição nem chegou à origem: o cache repetiu o erro, com `Age: 0`, para quem quer que perguntasse. Com um `max-age` de cinco minutos, o erro se repetiria por cinco minutos para todos os clientes, mesmo que o serviço já tivesse se recuperado. E a cópia boa, a que o `stale-if-error` estava ali para proteger, se perdeu.

Os cabeçalhos em minúsculas das respostas que passaram pela origem (`content-type`, `cache-control`) não são um erro: o `fetch` entrega os nomes em minúsculas e o cache os repassou assim. Os nomes dos cabeçalhos não distinguem maiúsculas de minúsculas, segundo a [seção 5.1 do RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.1), e nenhum programa deve compará-los de outra forma.

Também não é um erro faltar `Content-Length` e aparecer `Transfer-Encoding: chunked`. Em 0.2.2 o corpo terminava onde `Content-Length` dizia, mas `fig00_04.ts` não calcula o tamanho antes de `writeHead`, e então o Node envia o corpo **em pedaços** (*chunks*): a [documentação do Node](https://nodejs.org/docs/latest-v24.x/api/http.html) diz que enviar `Content-Length` é o que desativa essa forma, que é a padrão. Segundo a [seção 7.1 do RFC 9112](https://www.rfc-editor.org/rfc/rfc9112.html#section-7.1), cada pedaço leva seu próprio tamanho na frente, e um pedaço de tamanho zero marca o fim. São duas maneiras de dizer onde o corpo acaba; o `curl` entende as duas e mostra o mesmo corpo.

Falta o monitor. Pergunte diretamente à origem mentirosa com o health check de 0.5:

```text
$ curl -f http://127.0.0.1:18081/servicios
{"error":"la base de datos no está disponible"}
$ echo $?
0
```

O health check passou. O serviço está fora do ar e o health check diz que está bem. Esse é o monitor verde da cena do começo.

#### 0.8.3 Segunda execução: a origem diz a verdade

Pare o programa com `Ctrl`+`C` e inicie-o de novo, para começar com o cache vazio. Agora a origem passa a ser honesta:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
content-type: application/json
cache-control: max-age=5, stale-if-error=600
Date: Wed, 21 Oct 2026 07:28:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"servicios":["catalogo","pagos"]}
$ curl -X PUT http://127.0.0.1:18081/modo/honesto
$ sleep 6
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
Content-Type: application/json
Age: 6
Date: Wed, 21 Oct 2026 07:28:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"servicios":["catalogo","pagos"]}
$ curl -f http://127.0.0.1:18081/servicios
curl: (22) The requested URL returned error: 503
$ echo $?
22
```

E no terminal do programa:

```text
origen en http://127.0.0.1:18081 (PUT /modo/sano|mentiroso|honesto)
caché en http://127.0.0.1:18080/servicios
caché: guardé la respuesta 200 por 5 s
origen: ahora estoy honesto
caché: el origen respondió 503; sirvo la copia anterior
```

Mesmo serviço, mesma queda, outro número. O cache recebeu um `503`, reconheceu-o como erro porque ele está na lista do RFC 5861, e serviu a última cópia boa, com `Age: 6` para que quem quiser saiba que ela tem seis segundos. Os clientes continuam vendo a lista de serviços enquanto a origem se recupera. E o health check, que pergunta direto à origem, falhou com o código 22: o monitor fica vermelho, alguém recebe um alerta e começa a trabalhar. **O `503` protegeu os clientes e avisou quem opera, ao mesmo tempo.** O `200` mentiroso fez o contrário nas duas frentes.

Esse é o estrago completo, medido: o **cache** guarda o erro e perde a cópia boa; o **monitor** continua verde; e o **cliente**, que faz `if (respuesta.ok)`, acredita que recebeu dados. Os três decidiram bem com o que leram. Quem errou foi o número.

Pare o programa com `Ctrl`+`C`. Não sobra nada escutando.

### 0.9 Verificar os tipos com `tsc` (opcional)

O Node remove os tipos e executa; **não os verifica**. Escrevendo `const x: number = "a"`, o Node roda sem reclamar. Por isso o curso verifica seus programas com `tsc`, o compilador do TypeScript, em modo estrito, e dá para fazer o mesmo quando se quiser. Não faz parte do curso e não é necessário para nenhuma lição. Dentro de `~/curso-http/`:

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --types node fig00_01.ts fig00_02.ts fig00_03.ts fig00_04.ts
```

O primeiro comando traz o compilador e as descrições de tipos do Node para uma pasta `node_modules/`, sem registrá-los no `package.json` (é isso que `--no-save` faz). O segundo verifica os quatro programas sem gerar arquivos (`--noEmit`); `--erasableSyntaxOnly` pede a ele que rejeite o que o Node não saberia apagar, e `--verbatimModuleSyntax` que exija `import type` onde só se importa um tipo, como em `fig00_02.ts`. São as opções que a documentação do Node recomenda para este modo de trabalho. Se tudo estiver certo, `tsc` não imprime nada e termina com código 0, que foi o resultado com os quatro programas desta lição.

## O erro a ser observado

**A porta ocupada.** É o erro que mais vai aparecer neste curso, porque todos os programas usam a porta 18080. Ao iniciar um servidor enquanto outro continua escutando nessa porta, o Node para assim:

```text
$ node fig00_01.ts
node:events:486
      throw er; // Unhandled 'error' event
      ^

Error: listen EADDRINUSE: address already in use 127.0.0.1:18080
    at Server.setupListenHandle [as _listen2] (node:net:1948:16)
    at listenInCluster (node:net:2005:12)
    at node:net:2214:7
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
Emitted 'error' event on Server instance at:
    at emitErrorNT (node:net:1984:8)
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21) {
  code: 'EADDRINUSE',
  errno: -48,
  syscall: 'listen',
  address: '127.0.0.1',
  port: 18080
}

Node.js v24.14.1
```

Lê-se pela linha que começa com `Error:`: `listen` falhou com `EADDRINUSE`, endereço já em uso, em `127.0.0.1:18080`. As linhas com `at` são o caminho interno do Node e não dizem nada útil aqui. No Linux, `errno` diz `-98` em vez de `-48` (é o mesmo erro com o número de outro sistema), e os números de linha de `node:net` mudam com a versão do Node. Quase sempre a causa é um programa anterior do curso que continua rodando em outro terminal: procure-o e pare-o com `Ctrl`+`C`. Se não for encontrado, pergunte ao sistema que processo escuta nessa porta: no Linux, `ss -ltnp 'sport = :18080'` o mostra com seu número como `pid=NNNN`; no macOS, `lsof -iTCP:18080 -sTCP:LISTEN` o mostra na coluna `PID`. Com esse número ele é interrompido: `kill NNNN`.

**Ninguém escutando.** O erro oposto: pede-se algo a uma porta onde não há nenhum servidor. Já não é um erro do Node, e sim do `curl`:

```text
$ curl -i http://127.0.0.1:18080/
curl: (7) Failed to connect to 127.0.0.1 port 18080 after 0 ms: Couldn't connect to server
```

Repare no que **não** há: não há linha de status, nem cabeçalhos, nem código. Não houve resposta HTTP, porque não houve conversa. Essa distinção importa muito para o `revisor`: «o serviço respondeu `503`» e «não foi possível conectar» são falhas diferentes, com causas diferentes, e o `revisor` vai reportá-las de forma diferente. O código 7 do `curl` diz «não consegui conectar»; o 22 da seção 0.5 diz «conectei e o servidor respondeu um erro». Um script que só olha se o código de saída é diferente de zero não distingue os dois.

## O que se costuma fazer de errado

**Responder `200` com o erro no corpo.** O custo foi medido em 0.8: o cache o guarda e perde a cópia boa, o health check passa e o cliente que confia em `ok` segue em frente. A correção não é acrescentar ao corpo um campo `"exito": false` mais visível: é colocar a verdade no número.

**Decidir com a frase da linha de status.** `if (statusText === "Not Found")` para de funcionar com o primeiro servidor que a traduz ou a omite, e o RFC 9112 avisa que a frase pode se perder ao passar para outra versão do HTTP. Em 0.5.2 viu-se que o Node e o registro oficial já usam frases diferentes para três códigos.

**Inventar códigos próprios.** Um `299` ou um `471` caseiro ninguém mais entende, e a regra de 0.6 faz todos os tratarem como `200` ou `400`. Se o que se queria dizer não cabe em um código registrado, cabe no corpo, e a Lição 5 dá o formato.

**Escrever um cliente que só conhece seus códigos.** Um `switch` que reconhece `200`, `404` e `500`, e trata todo o resto como «erro desconhecido», transforma um `204` em uma falha. A regra do `x00` existe justamente para que isso não aconteça.

**Tratar «não foi possível conectar» como um código.** Alguns programas convertem uma conexão recusada em um `500` ou em um `0` falso, para que «tudo seja um número». Perde-se a informação mais útil: se o servidor respondeu ou não.

**Medir com um servidor que não olha o caminho.** O servidor de 0.2.1 responde `200` a `/servicios`, a `/lo-que-sea` e a todo o resto. Serve para ver a forma de uma resposta e para nada mais; um servidor assim engana qualquer teste feito contra ele.

## Exercícios

Os quatro se corrigem sozinhos: cada um termina com uma execução que diz se a previsão estava certa. Escreva a previsão no [diário de bordo](bitacora.md) **antes** de rodar qualquer coisa.

### Exercício 1 — Quatro códigos que o leitor não conhece

Sem rodar nada, preveja para cada um destes códigos três coisas: o que `respuesta.ok` diz, como `comoSiFuera` o trata e que código de saída `curl -f` dá. Os códigos são `226`, `418`, `451` e `799`. Depois troque a lista do laço de `fig00_03.ts` por `[226, 418, 451, 799]`, rode o ambiente de testes e o leitor, e compare. Para `curl -f`, use `curl -s -o /dev/null -w '%{http_code}\n' -f` seguido do endereço, e depois `echo $?`.

### Exercício 2 — Seguir o redirecionamento

Com o ambiente de testes rodando, preveja o que `curl -i -L http://127.0.0.1:18080/codigo/308` imprime. A opção `-L` diz ao `curl` para seguir o `Location`. Quantas linhas de status vão aparecer? Que caminho aparece no corpo final? E o que o ambiente de testes escreve em seu terminal? Rode o comando e compare.

### Exercício 3 — Contar a família `4xx` no registro

Baixe o registro de códigos da IANA em CSV:

```bash
curl -s -o codigos.csv https://www.iana.org/assignments/http-status-codes/http-status-codes-1.csv
```

Conte quantos códigos `4xx` há **atribuídos** usando `grep`. Depois procure que especificação define o `429` e o `451`, e o que o registro diz do `418`. Compare a contagem com a da seção 0.7.1: se não deu 28, a solução explica por quê.

### Exercício 4 — Um mentiroso que não deixa guardar

Alguém propõe uma correção para o problema de 0.8 que não mexe no número: que a origem mentirosa envie `Cache-Control: no-store` em seus erros, para que o cache não os guarde. Copie `fig00_04.ts` como `ej4.ts` e troque o cabeçalho da resposta `200` por este, que só autoriza guardar as respostas saudáveis:

```ts
    "Cache-Control": modo === "sano" ? "max-age=5, stale-if-error=600" : "no-store",
```

Antes de rodar, preveja o que um cliente do cache vê quando a origem mente, e se o cache serve a cópia boa. Depois repita a primeira execução de 0.8.2 com `ej4.ts` e compare. A correção resolve o problema?

## Soluções

As quatro soluções foram executadas com [`soluciones.sh`](../programas/00-el-contrato-que-viaja/soluciones.sh), que cria as cópias `ej1.ts` e `ej4.ts` em uma pasta temporária e usa as portas do curso; sua saída completa está em `soluciones.salida.txt`. As datas dos cabeçalhos mudam a cada execução; o resto deve coincidir.

### Solução 1

```text
$ node ej1.ts
226  ok=true   se trata como 200 (éxito)
418  ok=false  se trata como 400 (error del cliente)
451  ok=false  se trata como 400 (error del cliente)
799  ok=false  se trata como 500 (error del servidor)
$ curl -s -o /dev/null -w '%{http_code}\n' -f http://127.0.0.1:18080/codigo/226; echo $?
226
0
$ curl -s -o /dev/null -w '%{http_code}\n' -f http://127.0.0.1:18080/codigo/418; echo $?
418
22
$ curl -s -o /dev/null -w '%{http_code}\n' -f http://127.0.0.1:18080/codigo/451; echo $?
451
22
$ curl -s -o /dev/null -w '%{http_code}\n' -f http://127.0.0.1:18080/codigo/799; echo $?
799
22
```

(Aqui `ej1.ts` é a cópia de `fig00_03.ts` com a lista trocada; se `fig00_03.ts` foi editado diretamente, o comando é `node fig00_03.ts`.) O `226` (*IM Used*) existe no registro, mas não está na tabela do leitor, então é tratado como o `200` de sua família, e `ok` é `true` porque está entre 200 e 299. O `418` e o `451` (*Unavailable For Legal Reasons*, que também existe) são tratados como `400`. O `799` é inválido e é tratado como `500`. Para `curl -f` não há surpresas: tudo o que é `400` ou mais dá 22, e sim, isso inclui o `799` inválido. Se o `451` foi errado, repare na lição do exercício: um código existir no registro não significa que o programa o conheça, e para isso existe a regra do `x00`.

### Solução 2

```text
$ curl -i -L http://127.0.0.1:18080/codigo/308
HTTP/1.1 308 Permanent Redirect
Location: /codigo/200
Content-Type: text/plain; charset=utf-8
Content-Length: 49
Date: Tue, 27 Oct 2026 10:26:22 GMT
Connection: keep-alive
Keep-Alive: timeout=5

HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 33
Date: Tue, 27 Oct 2026 10:26:22 GMT
Connection: keep-alive
Keep-Alive: timeout=5

200 OK
lo pediste en /codigo/200
```

Duas linhas de status: com `-i`, o `curl` mostra os cabeçalhos de **cada** resposta do caminho, mas o corpo só da última. O corpo do `308` existiu (49 bytes, diz seu `Content-Length`), mas o `curl` não o mostra porque seguiu em frente. O caminho final é `/codigo/200`, o do `Location`, que é relativo: o `curl` o completou com o host e a porta da requisição original. No terminal do ambiente de testes apareceram duas linhas, `GET /codigo/308` e `GET /codigo/200`: foram duas requisições, não uma. O que muda entre `301` e `308` quando a requisição é um `POST` é tema da Lição 1.

### Solução 3

```text
$ grep -E '^4[0-9]{2},' codigos.csv | wc -l
31
$ grep -E '^4[0-9]{2},' codigos.csv | grep -vc -e Unassigned -e Unused
28
$ grep -E '^(418|429|451),' codigos.csv
418,(Unused),"[RFC 9110, Section 15.5.19]"
429,Too Many Requests,[RFC 6585]
451,Unavailable For Legal Reasons,[RFC 7725]
```

A armadilha é a do primeiro comando: dá 31, não 28. O registro escreve as lacunas de duas maneiras. As lacunas grandes vão como uma faixa em uma única linha (`432-450,Unassigned`), e o padrão `^4[0-9]{2},` não as conta porque depois dos três dígitos vem um hífen e não uma vírgula. Mas as lacunas de um único número vão em sua própria linha, com seu número (`427,Unassigned` e `430,Unassigned`), e o padrão as conta. Some o `418`, que não está atribuído, e sim reservado sem uso, e estão aí as três linhas a mais. O segundo comando as tira e dá 28, o mesmo número que saiu em 0.7.1 com um programa que lê o CSV coluna por coluna; quando uma contagem importa, ela é feita duas vezes de duas formas diferentes. O `429` é definido pelo RFC 6585, o `451` pelo RFC 7725, e o `418` aparece como `(Unused)` com referência à seção 15.5.19 do RFC 9110, que é a que explica por que ele ficou reservado.

### Solução 4

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
content-type: application/json
cache-control: max-age=5, stale-if-error=600
Date: Wed, 21 Oct 2026 08:05:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"servicios":["catalogo","pagos"]}
$ curl -X PUT http://127.0.0.1:18081/modo/mentiroso
$ sleep 6
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
content-type: application/json
cache-control: no-store
Date: Wed, 21 Oct 2026 08:05:49 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"error":"la base de datos no está disponible"}
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
content-type: application/json
cache-control: no-store
Date: Wed, 21 Oct 2026 08:05:49 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"error":"la base de datos no está disponible"}
$ curl -f http://127.0.0.1:18081/servicios
{"error":"la base de datos no está disponible"}
$ echo $?
0
```

E no terminal do programa:

```text
origen en http://127.0.0.1:18081 (PUT /modo/sano|mentiroso|honesto)
caché en http://127.0.0.1:18080/servicios
caché: guardé la respuesta 200 por 5 s
origen: ahora estoy mentiroso
caché: el origen respondió 200; no la guardo
caché: el origen respondió 200; no la guardo
```

A correção limita o estrago, mas não o resolve. O cache já não guarda o erro, então não o repete para todos durante minutos: cada requisição pergunta de novo à origem. Mas também não serve a cópia boa, que continuava ali, porque o `stale-if-error` só é ativado com um `500`, `502`, `503` ou `504`, e o que chegou foi um `200`. O cliente vê o erro em cada requisição, o health check continua passando, e a cópia boa não serve para nada. Compare com a segunda execução de 0.8.3: o `503` fez as três coisas certas ao mesmo tempo. Nenhum cabeçalho compensa um número errado.

## Critérios de sucesso

- [ ] `node -v` começa com `v24`, e `curl --version` responde.
- [ ] Com `fig00_01.ts` rodando, dá para apontar na saída de `curl -i` a linha de status, cada cabeçalho, a linha vazia e o corpo, e explicar por que `Content-Length` diz 28 e não 27.
- [ ] Dá para explicar o que `curl -v` mostra que `curl -i` não mostra, e o que significam as linhas com `>` e com `<`.
- [ ] `curl -i http://127.0.0.1:18080/codigo/503` contra o ambiente de testes dá `503 Service Unavailable` com `Retry-After: 120`, e `curl -i -X DELETE` dá `405` com `Allow: GET, HEAD`, igual a 0.4.3.
- [ ] `node fig00_03.ts` imprime as oito linhas de 0.6.2, e dá para explicar sem olhar por que o `471` é tratado como `400` e o `600` como `500`.
- [ ] Dá para dizer de memória a regra do `x00` e em que seção do RFC 9110 ela está.
- [ ] As duas execuções de 0.8 foram repetidas e os terminais mostram o mesmo que a lição, exceto a data: o erro guardado com `Age: 0` na primeira, e a cópia boa com `Age: 6` e o código de saída 22 na segunda.
- [ ] A contagem de códigos `4xx` atribuídos no registro da IANA deu 28, e sabe-se por que a contagem ingênua dá 31.
- [ ] Ao terminar, não sobra nenhum programa escutando: `curl -i http://127.0.0.1:18080/` dá o erro 7.

## Resumo

Responda sem olhar a lição:

1. Quais são as três partes de uma resposta HTTP e o que as separa?
2. Por que um cliente deveria ignorar a frase da linha de status? Dê um exemplo desta lição.
3. Que pergunta cada uma das cinco famílias responde, e por que a `1xx` é diferente das outras quatro?
4. O que um cliente deve fazer com um código que não conhece? E com um maior que 599?
5. Quem decide que códigos existem, e onde se consulta a lista?
6. O que significa «o código manda e o corpo explica»? O que acontece quando os dois não dizem a mesma coisa?
7. No cache de 0.8, por que o `200` mentiroso perde a cópia boa e o `503` a preserva?
8. Em que se distinguem o erro 7 e o erro 22 do `curl`, e por que essa diferença importa para o `revisor`?

## Fontes

Todas foram consultadas em 21 de outubro de 2026.

1. [RFC 9110, *HTTP Semantics*](https://www.rfc-editor.org/rfc/rfc9110.html), seção 15: as cinco famílias, a regra do `x00` para um código desconhecido e a dos valores fora de 100 a 599. É a fonte principal desta lição e do curso.
2. [RFC 9110, seções 15.5 e 15.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5): em um `4xx` e em um `5xx`, o servidor deveria explicar o erro no corpo, exceto em uma resposta a `HEAD`.
3. [RFC 9110, seções 15.3.2, 15.5.2 e 15.5.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.2): `Location` no `201`, `WWW-Authenticate` obrigatório no `401` e `Allow` obrigatório no `405`, os cabeçalhos do ambiente de testes.
4. [RFC 9110, seção 16.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-16.2.1): o registro de códigos de status da IANA e a revisão da IETF que um código novo exige.
5. [RFC 9112, *HTTP/1.1*](https://www.rfc-editor.org/rfc/rfc9112.html), seção 4: a forma da linha de status e por que um cliente deveria ignorar a frase.
6. [RFC 9111, *HTTP Caching*](https://www.rfc-editor.org/rfc/rfc9111.html), seções 3 e 5.1: quando um cache pode guardar uma resposta e o que diz o cabeçalho `Age`.
7. [RFC 5861, *HTTP Cache-Control Extensions for Stale Content*](https://www.rfc-editor.org/rfc/rfc5861.html), seção 4: `stale-if-error` e a lista fechada de códigos que contam como erro (`500`, `502`, `503`, `504`).
8. [RFC 6585, *Additional HTTP Status Codes*](https://www.rfc-editor.org/rfc/rfc6585.html): define o `428` e o `429`, e o `Retry-After` opcional do `429`.
9. [Registro de códigos de status do HTTP, IANA](https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml), versão atualizada em 15 de setembro de 2025: daqui saem os 62 códigos atribuídos, as frases do ambiente de testes e o `418` reservado sem uso.
10. [Registro de nomes de campos do HTTP, IANA](https://www.iana.org/assignments/http-fields/http-fields.xhtml): os 260 cabeçalhos registrados e seu estado.
11. [Registro de tipos de problema do HTTP, IANA](https://www.iana.org/assignments/http-problem-types/http-problem-types.xhtml), criado pelo [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html): seis entradas, a primeira `about:blank`. É usado na Lição 5.
12. [Padrão Fetch, WHATWG](https://fetch.spec.whatwg.org/): a definição de um status *ok* (de 200 a 299) que `respuesta.ok` usa.
13. [Manual do `curl`](https://curl.se/docs/manpage.html): `-i` (`--show-headers`), `-v`, `-I`, `-f` e o código de saída 22.
14. [Node.js 24: TypeScript](https://nodejs.org/docs/latest-v24.x/api/typescript.html) e [Node.js 24: HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html): a execução de `.ts` removendo tipos, a sintaxe que ele não admite, as opções recomendadas do `tsc` e a assinatura de `writeHead`.
15. [Calendário de versões do Node.js](https://github.com/nodejs/Release) e [nvm](https://github.com/nvm-sh/nvm): as datas de LTS do Node 24 e 26, e o instalador do nvm 0.40.8.

### Leitura complementar

- A série **«HTTP y Problem Details»** de [En construcción](https://enconstruccionmx.substack.com/), o boletim da Hábil, em quatro edições. A primeira, «El 200 que mentía», conta com outra história a mesma ideia desta lição e percorre treze códigos com uma API de contatos, um servidor que mente e outro que não mente; a segunda desmonta o formato dos *Problem Details* que este curso ensina na Lição 5; a terceira e a quarta o implementam em Spring Boot, Quarkus, ASP.NET Core, FastAPI e Go. Este curso não as repete: para ver os códigos com outro exemplo, ou o formato na linguagem de preferência, comece por ali.

### Termos desta lição

| | |
|---|---|
| **cabeçalho** (*header field*) | cada linha `Nombre: valor` entre a linha de status e o corpo; os nomes não distinguem maiúsculas |
| **cache compartilhado** | programa entre clientes e servidor que guarda respostas e as repete para qualquer cliente |
| **health check** | teste automático que decide se um serviço está bem, quase sempre pelo código de status |
| **código de status** | o número de três dígitos da linha de status; seu primeiro dígito é a família |
| **família** | a classe de um código segundo seu primeiro dígito: `1xx` a `5xx` |
| **IANA** | o órgão que mantém os registros oficiais de códigos, cabeçalhos e tipos de mídia |
| **linha de status** | a primeira linha de uma resposta: versão, código e frase |
| ***reason phrase*** | a frase depois do código (`OK`, `Not Found`); decorativa, um cliente deveria ignorá-la |
| **resposta intermediária** | uma resposta `1xx`: chega antes da resposta final e nunca a substitui |
| **LTS** | *long-term support*: uma linha de versões que recebe correções durante anos |

---

**Próxima:** [Lição 1 — Sucessos e redirecionamentos: 200, 201, 202, 204, 301, 308 e 304](01-exitos-redirecciones.md)

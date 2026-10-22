# Lição 1 — Sucessos e redirecionamentos: 200, 201, 202, 204, 301, 308 e 304

São 11:20 de uma terça-feira e às 12:00 há uma reunião com a equipe de operações. A pergunta a ser feita é simples: por que o `revisor` não monitorou o serviço de cobranças durante o fim de semana, se alguém o cadastrou na sexta? Quem fez o cadastro jura que fez. Tem a captura de tela do terminal: enviou o cadastro e recebeu um `200 OK`. Abre-se a lista de serviços do `revisor` e o de cobranças não está lá. Abre-se o log do servidor e a requisição está ali, completa, às 18:42 de sexta-feira. Só que o log não diz `POST /servicios`. Diz `POST /viejo/servicios` e, logo abaixo, `GET /servicios`. Na quinta-feira alguém migrou as rotas antigas com um redirecionamento. O programa seguiu o redirecionamento, como deveria. E no meio do caminho, sem nenhum erro sequer, o cadastro se transformou em uma consulta. Faltam quarenta minutos para explicar por que um `200` não significava o que todo mundo achava.

Esta lição é sobre as respostas que dizem «deu certo» e as que dizem «está em outro lugar»: o que cada uma promete, quais cabeçalhos a acompanham e qual delas pode perder um `POST` sem avisar.

**Tempo:** 2 × 45 min (a divisão está entre as seções 1.5 e 1.6)

**O que se constrói:** a primeira versão do **`revisor`** como servidor: as rotas que cadastram, consultam e removem serviços, a que solicita uma revisão e a que permite acompanhá-la, as rotas antigas redirecionadas e a primeira defesa para impedir que alguém use o `revisor` para chegar aonde não deve. Além disso, o **laboratório**: o ambiente de testes da Lição 0 na porta 18081, com os serviços consultados pelo `revisor`.

**O que se aprende:** escolher entre retornar (`200`), criar (`201`), aceitar (`202`) e não retornar nada (`204`); para que serve `Location` em um `201`, em um `202` e em um redirecionamento; **o `202` e o recurso de acompanhamento**; o que muda entre `301` e `308` quando a requisição é um `POST`; as requisições condicionais com `ETag` e `If-None-Match`, e por que um `304` não tem corpo. E em um quadro de segurança, o que é **SSRF** e por que um programa como o `revisor` é o caso típico.

**Ponto de partida.** Da [Lição 0](00-el-contrato-que-viaja.md) traz-se o Node 24 e a pasta `~/curso-http/`, as ferramentas (`curl -i`, `curl -v`, `curl -I`), as cinco famílias e a regra do `x00`, além do ambiente de testes `fig00_02.ts`, que responde com o código solicitado em `/codigo/NNN`. Traz-se também o primeiro princípio do curso: o código manda e o corpo explica. Ainda não há `revisor`: ele nasce nesta lição.

**O que esta lição não faz.** Não exige credenciais: qualquer um que acessar a porta pode cadastrar e remover serviços; a [Lição 2](02-errores-del-cliente-peticion.md) introduz o ponto de entrada. Também não permite alterar um serviço já cadastrado; isso requer `If-Match` e é tema da [Lição 3](03-errores-del-cliente-estado.md). Os erros que vão aparecer aqui, um `400`, um `404` e um `413`, funcionam como uma **rede de segurança**: estão ali para que o `revisor` não responda `200` quando algo der errado, mas são explicados a fundo na Lição 2, e o corpo de resposta é apenas uma linha de texto até a [Lição 5](05-problem-details.md) formatá-lo. Há também um defeito proposital: um método não aceito pela rota responde `404` em vez de `405`; a seção «O erro a ser observado» aponta esse detalhe e a Lição 2 o corrige.

**Sobre as execuções.** O Linux Mint 22 é o sistema de referência do curso. As saídas desta lição foram obtidas em 21 de outubro de 2026 no macOS com Node 24.14.1 e curl 8.7.1, adicionando `-sS` a cada `curl` porque a saída foi direcionada para um arquivo (`-s` desativa o indicador de progresso, `-S` permite ver os erros, e nenhum dos dois altera a resposta). **Um aviso sobre as portas:** enquanto esta lição era escrita, outros testes ocupavam as portas 18080 e 18081 da máquina, de modo que as execuções foram feitas com uma cópia idêntica dos programas, exceto pelas portas, 18180 e 18181; nas saídas incluídas aqui, foram reescritas como 18080 e 18081, que são as portas a serem digitadas no terminal. Foi a única alteração; os dois números têm a mesma quantidade de dígitos, portanto nenhum `Content-Length` é alterado. Na execução local mudam também a data em `Date`, os milissegundos (`"ms"`) medidos por uma revisão e **as etiquetas `ETag`**: ao iniciar, o `revisor` sorteia oito dígitos hexadecimais adicionados ao final de cada etiqueta (`"4-1-7b2497d9"`), de modo que as geradas localmente terminarão com valores diferentes e mudarão a cada reinicialização; a seção 1.8 explica o motivo. Quando um comando da lição contiver uma etiqueta, copie a que foi retornada pela resposta anterior, não a da lição. As execuções foram feitas seguindo a lição do início ao fim, em sequência, reiniciando o serviço nos momentos indicados, garantindo que os números de serviço e de revisão coincidam com os apresentados. Não foi executado em uma instalação de desktop do Mint. Os programas estão em [`programas/01-exitos-redirecciones/`](../programas/01-exitos-redirecciones), no repositório do curso: o `revisor` na pasta `fig01_01/` e cada execução em um arquivo `.salida.txt`. Todos passam pelo `tsc` em modo estrito (a seção 1.11 mostra como verificar).

## Ao terminar, será possível

- Iniciar o `revisor` e o ambiente de laboratório, e percorrer com `curl -i` o ciclo completo de um serviço: cadastro, consulta, revisão e remoção.
- Escolher entre `200`, `201`, `202` e `204` para uma operação com três perguntas, e justificar a escolha com base na seção da RFC 9110 que a define.
- Dizer o que `Location` identifica em um `201`, em um `202` e em um redirecionamento, e comprovar isso em uma resposta real.
- Acompanhar uma operação aceita com `202` até a conclusão, respeitando `Retry-After`, sem sobrecarregar o servidor.
- Provocar um `304` com `If-None-Match`, explicar por que não há corpo e quais cabeçalhos devem ser enviados.
- Demonstrar com `curl -L` que um `301` pode converter um `POST` em `GET` sem emitir nenhum erro, enquanto um `308` não faz isso.
- Explicar o que é SSRF, por que o `revisor` traz isso de nascença e quais defesas possui, incluindo a que chega na Lição 8.

## O porquê antes do como

Na Lição 0 viu-se que o código de status é o que todos os programas no caminho leem. Em respostas de erro, esse contrato é quebrado de uma forma que causa impacto imediato: um `200` com um erro dentro engana o cache e o monitoramento. Em respostas de sucesso, o dano é mais silencioso, porque todas dizem «deu certo», e a tentação é responder `200` sempre que nada falhar. Mas os quatro sucessos desta lição não dizem a mesma coisa, e quem recebe a resposta toma atitudes distintas com cada um:

- Um **`200`** diz «aqui está o que foi solicitado». O cliente usa o corpo.
- Um **`201`** diz «algo novo foi criado e fica neste endereço». O cliente guarda o endereço de `Location` para retornar a esse recurso.
- Um **`202`** diz «recebido, mas ainda não processado». O cliente **não** pode considerar a operação concluída: precisa consultar novamente.
- Um **`204`** diz «pronto, e não há nada a informar». O cliente não espera nenhum corpo.

A diferença entre o `201` e o `202` é a que mais custa caro ao ser confundida. Se o `revisor` respondesse `200` ou `201` a uma revisão que mal vai começar, o cliente acreditaria que a revisão já terminou e leria um resultado inexistente. Se respondesse `200` a um cadastro, o cliente não teria uma forma padronizada de saber onde ficou o novo serviço.

Os redirecionamentos têm a própria armadilha, que é a da cena do início. Migrar uma rota é normal: APIs crescem e nomes mudam. Mas existem dois códigos para «mudou-se permanentemente», o `301` e o `308`, e por razões históricas apenas um deles garante que o `POST` continuará sendo `POST` no destino. Com o outro, o cliente tem permissão para convertê-lo em `GET`, e quase todos fazem isso. O cadastro se perde, a resposta final é um `200` com a lista, e ninguém vê erro algum porque nenhum erro aconteceu.

E o `304` fecha a lição com a ideia oposta ao `200`: às vezes a melhor resposta é **não enviar nada**, porque o cliente já tem a cópia. Para isso existem as etiquetas (`ETag`) e as requisições condicionais, que na Lição 3 servirão também para algo muito mais sério: evitar que duas pessoas alterem o mesmo serviço ao mesmo tempo e sobrescrevam o trabalho uma da outra.

A lição tem cinco partes:

1. **O `revisor` toma forma** (1.1 a 1.3): os arquivos, o armazenamento, as três formas de responder e a tabela de rotas.
2. **Retornar e criar** (1.4 e 1.5): `200` e `201`, com `Location` e `ETag`.
3. **Aceitar e não retornar nada** (1.6 e 1.7): `202` com o recurso de acompanhamento, e `204`.
4. **Não enviar o que já se tem, e migrar** (1.8 e 1.9): `304` com `If-None-Match`, e `301` versus `308`.
5. **O quadro de segurança** (1.10): SSRF, a exceção do laboratório e o limite declarado.

Ao final da lição, esta execução vai parecer óbvia. São duas requisições idênticas, exceto pela rota antiga utilizada; o `revisor` registrou isto em seu terminal:

```text
POST /viejo/servicios
GET /servicios
POST /api/servicios
POST /servicios
```

O primeiro cadastro se perdeu. O segundo ocorreu. A única mudança foi o código do redirecionamento.

## Os conceitos

### 1.1 O `revisor` toma forma

#### 1.1.1 Nove arquivos e uma pasta

A partir desta lição, o `revisor` deixa de ser um programa de um único arquivo. Passa a ser composto por vários, cada um com uma responsabilidade bem definida, crescendo de lição em lição: a Lição 2 adiciona o ponto de entrada, a 3 a alteração de serviços, a 4 a defesa contra falhas, e assim por diante até a 8. Os nove arquivos de hoje são estes:

| Arquivo | O que faz |
|---|---|
| `servidor.ts` | inicia o servidor na porta 18080 |
| `rutas.ts` | decide qual função atende a cada rota e método; aqui ficam os redirecionamentos |
| `servicios.ts` | o que cada rota faz: listar, cadastrar, consultar, remover, solicitar e acompanhar uma revisão |
| `almacen.ts` | os serviços e as revisões, em memória, e a etiqueta (`ETag`) de cada serviço |
| `etiquetas.ts` | ler e comparar etiquetas conforme a RFC 9110; usada na seção 1.8 |
| `respuestas.ts` | as três formas de responder: com JSON, sem corpo e com erro |
| `cliente.ts` | o lado cliente: consulta um serviço e classifica a resposta recebida |
| `destinos.ts` | para onde o `revisor` pode se conectar; tema do quadro de segurança |
| `laboratorio.ts` | o ambiente de testes da Lição 0 na porta 18081: os serviços consultados pelo `revisor` |

No repositório eles estão na pasta `fig01_01/`, e cada bloco de código desta lição começa com o caminho do arquivo (`// fig01_01/servidor.ts`), assim como no curso de TypeScript da Hábil. É possível salvá-los onde se quiser; aqui supõe-se uma pasta `~/curso-http/revisor/` com o respectivo `package.json`, o mesmo da Lição 0:

```bash
mkdir -p ~/curso-http/revisor && cd ~/curso-http/revisor
printf '{\n  "type": "module"\n}\n' > package.json
```

Os arquivos são importados entre si com a extensão `.ts` escrita por extenso (`import { atender } from "./rutas.ts"`). É o que o Node exige ao executar TypeScript sem os tipos: não há adivinhação de extensões, da mesma forma que não há adivinhação para JavaScript em módulos ESM.

#### 1.1.2 O servidor

```ts
// fig01_01/servidor.ts — la cara servidor del revisor: la API que administra los servicios observados.
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

É quase o servidor da Lição 0, com uma diferença: já não toma decisões. Recebe cada requisição e a repassa para `atender`, localizada em `rutas.ts`, por meio de `atenderSinCaerse`. O `void` antes da chamada diz «sabe-se que esta função retorna uma promessa e, de propósito, ela não é aguardada aqui»: o servidor não tem mais nada a fazer quando a resposta termina.

Esse `void` tem um custo, e `atenderSinCaerse` existe para pagá-lo. Uma promessa que ninguém aguarda e que falha é uma **promessa rejeitada não tratada**, e o Node, por padrão, encerra o processo ao encontrar uma. Se um *handler* contivesse um erro que lançasse uma exceção, uma única requisição derrubaria o `revisor` para todos. `atenderSinCaerse` envolve `atender` em um `try`/`catch`: se algo escapar, escreve a mensagem no terminal, responde `500 error interno` sem dar detalhes e o processo continua ativo. É uma rede de segurança, não um projeto arquitetural: a [Lição 4](04-capacidad-y-fallas-del-servidor.md) explica o `500` a fundo e o que se deve ou não dizer nele. Por enquanto, basta saber que ela está ali, e em 1.5.2 veremos a requisição que teria derrubado o `revisor` se ninguém a impedisse antes.

#### 1.1.3 O laboratório

O `revisor` monitora serviços, e para praticar é preciso ter serviços para monitorar. O laboratório é o ambiente de testes da Lição 0 sem alterações estruturais: a mesma tabela de nomes, os mesmos cabeçalhos por código, os mesmos três pontos de entrada. Mudam a porta, 18081, para conviver com o `revisor` na 18080, e a mensagem de inicialização:

```ts
// fig01_01/laboratorio.ts
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

Os três serviços com os quais o `revisor` inicializa apontam para cá: `catalogo` para `/codigo/200`, `pagos` para `/codigo/503` e `nomina` para `/codigo/200`. Para simular que um serviço «caiu» ou ficou fora do ar, não é preciso mexer em nada: basta cadastrar um que aponte para `/codigo/503`.

#### 1.1.4 Iniciar ambos

Cada lição do curso que utiliza o `revisor` precisa de dois terminais rodando servidores e um terceiro para o `curl`. No primeiro:

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

No segundo:

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

Mantenha ambos abertos. O terminal do `revisor` anotará cada requisição recebida (`GET /servicios`, `POST /servicios`…), e essa lista é tão importante quanto o que o `curl` imprime: na seção «O erro a ser observado», ela é a única que conta a verdade completa.

Antes de ler os arquivos um a um, verifique se o `revisor` já responde. Se ainda não foram escritos, copie-os de `programas/01-exitos-redirecciones/fig01_01/`, no repositório do curso, e inicie-os; as seções seguintes explicam o que produziu cada resposta. No terceiro terminal:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 275
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}
```

Um `200` com a lista dos três serviços iniciais, seu `Content-Type` e seu `Content-Length`. Nada de novo em relação à Lição 0, exceto pelo fato de que agora a lista é real. A seção 1.4 explica como ela foi gerada.

### 1.2 Armazenar e responder

#### 1.2.1 O armazenamento

```ts
// fig01_01/almacen.ts — los servicios que observa el revisor y las revisiones pedidas, en memoria.
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

O armazenamento guarda duas coisas em memória, em dois `Map`: os **serviços** e as **revisões**. Ao parar o `revisor`, tudo se perde, de propósito: cada execução começa com os mesmos três serviços iniciais, fazendo com que o que aparece no terminal coincida com o texto da lição. Um serviço tem o `id`, o `nombre`, a `url` consultada, o `limiteMs` (quanto tempo se espera pela resposta antes de considerá-lo fora do ar), a equipe (`equipo`) a que pertence, que a Lição 2 usará para definir quem pode ver o quê, e uma versão (`version`).

A `version` é a engrenagem que faz a seção 1.8 funcionar. A função `etiqueta` monta um texto entre aspas com três partes, `"4-1-7b2497d9"`: o `id`, a `version` e um **identificador de inicialização**. Esse texto é a **etiqueta de entidade** (*entity tag*, a `ETag`) do serviço. Hoje nenhum serviço muda, portanto a versão é sempre 1; na Lição 3, cada alteração a incrementa e a etiqueta muda junto. As aspas não são enfeite: a [RFC 9110, seção 8.8.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3), define a etiqueta como um texto **opaco entre aspas duplas** e estabelece que, para o cliente, ela é opaca: não é preciso saber como foi gerada, apenas compará-la. A [seção 8.8.3.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.1) dá como exemplo exatamente o que o `revisor` faz: usar um número de versão interno.

E o identificador de inicialização? São 4 bytes aleatórios (`randomBytes(4)`, oito dígitos hexadecimais) que `almacen.ts` sorteia uma vez, ao inicializar. Existem devido a uma regra da [RFC 9110, seção 8.8.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.1): uma etiqueta forte é única entre todas as versões de todas as representações de um recurso **ao longo do tempo**. O armazenamento fica em memória; ao reiniciar o `revisor`, os `id` e as versões recomeçam do zero. Sem o identificador, o serviço 4 antes de um reinício e o serviço 4 depois (que pode ser outro completamente diferente) teriam a mesma etiqueta `"4-1"`, e um cliente que guardasse o primeiro receberia a confirmação de que sua cópia antiga continua válida. Com o identificador, uma etiqueta de uma inicialização não coincide, na prática, com as de outra (são 4 bytes aleatórios: uma probabilidade de uma em 4 295 milhões para cada inicialização anterior, nunca uma garantia matemática), sem precisar salvar nada em disco. Por isso as etiquetas da execução local terminam de modo diferente das da lição.

As revisões são mais simples: um `id`, o serviço revisado, um estado (`estado`) que começa em `"pendiente"` e passa para `"terminada"`, e um resultado (`resultado`) com valor `null` até a revisão ser concluída.

#### 1.2.2 As três formas de responder

```ts
// fig01_01/respuestas.ts — las tres formas de responder del revisor y la lectura del cuerpo.
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

O `revisor` responde de três maneiras, e cada uma fica em uma função própria, evitando que qualquer rota precise se lembrar dos detalhes:

- **`enviarJson`** responde com um corpo JSON. Calcula o `Content-Length` em bytes, como na Lição 0, e define `Content-Type: application/json`. É a função usada por `200`, `201` e `202`.
- **`enviarVacio`** responde sem corpo: para `204`, `304` e os redirecionamentos. Tem uma regra que merece atenção: não inclui `Content-Length` em `204` e `304`, e nos demais define `Content-Length: 0`. O motivo está na [RFC 9110, seção 8.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6): um servidor **não deve** enviar `Content-Length` em um `204`, e em um `304` só pode enviá-lo se indicar o mesmo valor que teria sido enviado no `200`, ou seja, o tamanho do corpo omitido. Já um redirecionamento pode conter corpo e, por isso, declara explicitamente tamanho zero.
- **`fallar`** responde a um erro com uma linha de texto. É uma solução provisória: a Lição 5 a substitui pelo formato *Problem Details* da RFC 9457, e essa mudança constitui o foco daquela lição.

As três passam por `escribirCabecera`, que corrige um detalhe já visto na Lição 0: o Node utiliza nomes antigos para dois códigos, de modo que para `413` e `422` o `revisor` insere as frases do registro da IANA.

`leerCuerpo` junta os fragmentos (*chunks*) do corpo de uma requisição e os converte em texto. Um corpo trafega pela rede em pedaços, e a requisição do Node é um fluxo (*stream*) iterável com `for await`; até que o último pedaço chegue, não há corpo completo para ler. Além disso, lê **no máximo 16 KiB** (`TOPE_CUERPO`, 16384 bytes). Um serviço é um nome curto (o modelo do curso prevê até 40 caracteres), uma URL e um número, e cabe com folga nesse limite. Atenção ao que essa frase não promete: nesta lição o `revisor` apenas verifica que `nombre` e `url` sejam texto; o tamanho do nome e as demais regras de conteúdo chegam com a validação da [Lição 3](03-errores-del-cliente-estado.md), e a única coisa que limita hoje o tamanho é o limite do corpo. Sem esse limite, quem alcançasse o `revisor` poderia enviar um corpo gigantesco, ou vários ao mesmo tempo, até lotar a memória dele. Por isso `leerCuerpo` não junta fragmentos às cegas: se `Content-Length` já anuncia mais que o limite, rejeita sem guardar nada; se o corpo chega por partes, sem anunciar seu tamanho, conta os bytes à medida que chegam e para de guardar assim que o limite é ultrapassado. Nos dois casos avisa com `CuerpoDemasiadoGrande` e prepara um **fechamento em etapas** (RFC 9112, seção 9.6): o `413` sai de imediato, com `Connection: close`; a conexão é fechada apenas para escrita (half-close), o `revisor` continua lendo e descartando o que o cliente conseguir enviar e, se o cliente não fechar o seu lado em 2 segundos, a destrói. Se fechasse de uma vez com o cliente ainda enviando, o sistema operacional responderia com um RST, que pode apagar o `413` antes de o cliente lê-lo. Quem estava lendo o corpo responde `413 Content Too Large`. A Lição 2 explica o `413` a fundo; aqui basta saber que ele existe e vê-lo uma vez, na seção 1.5.2.

### 1.3 A tabela de rotas

```ts
// fig01_01/rutas.ts — qué ruta y qué método atiende cada función.
import type { IncomingMessage, ServerResponse } from "node:http";
import { enviarVacio, fallar } from "./respuestas.ts";
import {
  consultar, consultarRevision, darDeAlta, listar, pedirRevision, retirar, type Contexto,
} from "./servicios.ts";

type Manejador = (contexto: Contexto) => void | Promise<void>;
type Ruta = { patron: RegExp; metodos: Record<string, Manejador> };

const RUTAS: Ruta[] = [
  { patron: /^\/servicios$/, metodos: { GET: listar, POST: darDeAlta } },
  { patron: /^\/servicios\/(\d+)$/, metodos: { GET: consultar, DELETE: retirar } },
  { patron: /^\/servicios\/(\d+)\/revisiones$/, metodos: { POST: pedirRevision } },
  { patron: /^\/revisiones\/(\d+)$/, metodos: { GET: consultarRevision } },
];

// Las rutas viejas: /viejo/... se mudó con 301 y /api/... con 308.
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

export async function atender(peticion: IncomingMessage, respuesta: ServerResponse): Promise<void> {
  console.log(`${peticion.method} ${peticion.url}`);
  const url = new URL(peticion.url ?? "/", "http://revisor");
  if (redirigir(url.pathname, url.search, respuesta)) return;
  // HEAD se atiende como GET; Node no manda el cuerpo.
  const metodo = peticion.method === "HEAD" ? "GET" : (peticion.method ?? "GET");
  for (const ruta of RUTAS) {
    const encontrada = ruta.patron.exec(url.pathname);
    // Object.hasOwn y no ruta.metodos[metodo] a secas: el método lo escribe el cliente, y un objeto también
    // «tiene» lo que hereda de Object.prototype (constructor, toString…).
    const manejador = Object.hasOwn(ruta.metodos, metodo) ? ruta.metodos[metodo] : undefined;
    if (encontrada !== null && manejador !== undefined) {
      await manejador({ peticion, respuesta, parametros: encontrada.slice(1) });
      return;
    }
  }
  // Todavía no distingue «no existe la ruta» de «no se permite el método»: eso es la lección 2.
  fallar(respuesta, 404, "no existe esa ruta");
}
```

`rutas.ts` responde a uma única pergunta: qual função atende a esta requisição? A tabela `RUTAS` tem uma linha por rota, com uma expressão regular que a identifica e, internamente, os métodos aceitos. Os parênteses da expressão (`(\d+)`) capturam o número do serviço ou da revisão e chegam à função como `parametros`.

`atender` executa quatro etapas em ordem. Anota no terminal o método e a rota. Verifica se é uma rota antiga migrada, chamando `redirigir` (explicada na seção 1.9). Trata `HEAD` como se fosse `GET`: a função de atendimento é a mesma e o Node, sabendo que a requisição era `HEAD`, não envia o corpo, conforme demonstrado na Lição 0 com `curl -I`. Por fim, percorre a tabela até encontrar uma rota correspondente **e** que possua uma função para esse método. Essa última verificação é feita com `Object.hasOwn(ruta.metodos, metodo)`, e não simplesmente `ruta.metodos[metodo]`, por motivos de segurança: o método é fornecido pelo cliente, e um objeto JavaScript também «possui» o que herda (`constructor`, `toString`…). Na abordagem ingênua, um cliente enviando o método `constructor` encontraria uma função não planejada para atendê-lo; com `Object.hasOwn`, contam apenas os métodos explicitamente declarados na tabela, e `constructor` recebe o mesmo `404` atribuído a qualquer método desconhecido.

Se nenhuma rota for encontrada, responde `404` com «no existe esa ruta». Observe o comentário nessa última linha: o `revisor` ainda não distingue entre «esta rota não existe» e «esta rota existe, mas não aceita este método». São duas respostas distintas, `404` e `405`, sendo que a segunda exige o cabeçalho `Allow`. Esse é o defeito intencional desta lição, a ser visto em «O erro a ser observado».

### 1.4 `200`: retornar o que foi solicitado

#### 1.4.1 A pergunta decisiva

O `200 OK` é a resposta de sucesso mais conhecida, e a RFC 9110 a define em sua [seção 15.3.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.1) com uma ideia que convém ler com atenção: o conteúdo de um `200` **depende do método**. Para um `GET`, retorna-se uma representação do recurso; para um `POST`, o estado ou o resultado da ação; para um `PUT` ou um `DELETE`, o estado da ação. Ou seja, o `200` não diz «tudo bem» no abstrato: diz «aqui está o corpo correspondente ao que foi pedido».

Daí decorre a pergunta decisiva: **há algo a retornar, e isso corresponde exatamente ao que foi pedido?** Se sim, `200`. Se a operação criou algo novo, há um código mais preciso (`201`). Se ainda não terminou, outro (`202`). Se terminou e não há nada a informar, outro (`204`). O `200` é o que sobra quando nenhum dos três mais específicos se aplica.

A mesma seção acrescenta dois detalhes. Um `200` em resposta a um `GET` ou a um `HEAD` **deveria** enviar os validadores disponíveis, como a `ETag`, e o `revisor` faz isso na consulta de um serviço. E um `200` **espera-se que traga conteúdo**, a menos que o enquadramento da mensagem declare explicitamente tamanho zero (`Content-Length: 0`); se algo na requisição indicar que o cliente prefere não receber conteúdo, a RFC sugere um `204` em seu lugar.

#### 1.4.2 No `revisor`

As duas rotas que retornam com `200` são `listar` e `consultar`, em `servicios.ts`. Este é o arquivo completo, pois todas as seções seguintes o utilizarão:

```ts
// fig01_01/servicios.ts — lo que hace cada ruta de la API del revisor.
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  buscarRevision, buscarServicio, crearRevision, crearServicio, etiqueta, listarServicios,
  retirarServicio, terminarRevision, type Revision, type Servicio,
} from "./almacen.ts";
import { revisarDestino } from "./destinos.ts";
import { coincideDebil, hayCoincidencia } from "./etiquetas.ts";
import { revisar } from "./cliente.ts";
import {
  CuerpoDemasiadoGrande, enviarJson, enviarVacio, fallar, leerCuerpo, TOPE_CUERPO, type Cabeceras,
} from "./respuestas.ts";

export type Contexto = {
  peticion: IncomingMessage;
  respuesta: ServerResponse;
  parametros: string[];
};

// Cuánto espera una revisión en la cola antes de empezar.
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

// SSRF: el revisor se conecta a la URL que alguien escribió. Se revisa al registrarla y otra vez
// antes de cada conexión (en cliente.ts). Si no se permite, ya respondió y devuelve false.
async function destinoPermitido(url: string, respuesta: ServerResponse): Promise<boolean> {
  const veredicto = await revisarDestino(url);
  if (veredicto.permitido) return true;
  fallar(respuesta, 400, `destino prohibido: ${veredicto.motivo}`);
  return false;
}

export function listar({ respuesta }: Contexto): void {
  enviarJson(respuesta, 200, { servicios: listarServicios().map(representar) });
}

export async function darDeAlta({ peticion, respuesta }: Contexto): Promise<void> {
  let leido: unknown;
  try {
    leido = JSON.parse(await leerCuerpo(peticion));
  } catch (error) {
    if (error instanceof CuerpoDemasiadoGrande) {
      // 413: el cuerpo es más grande de lo que el revisor acepta. La lección 2 lo explica.
      fallar(respuesta, 413, `el cuerpo pasa de ${TOPE_CUERPO} bytes`, { Connection: "close" });
      return;
    }
    fallar(respuesta, 400, "el cuerpo no es JSON");
    return;
  }
  // `null`, un número o una lista también son JSON válido, pero no traen campos: leer datos.nombre
  // sobre null lanzaría un TypeError. Solo un objeto sigue adelante.
  if (typeof leido !== "object" || leido === null || Array.isArray(leido)) {
    fallar(respuesta, 400, "el cuerpo no es un objeto JSON");
    return;
  }
  const datos: { nombre?: unknown; url?: unknown; limite_ms?: unknown } = leido;
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
  const servicio = crearServicio({ nombre: datos.nombre, url: datos.url, limiteMs, equipo: "a" });
  enviarJson(respuesta, 201, representar(servicio), {
    Location: `/servicios/${servicio.id}`,
    ETag: etiqueta(servicio),
  });
}

export function consultar({ peticion, respuesta, parametros }: Contexto): void {
  const servicio = buscarServicio(Number(parametros[0]));
  if (servicio === undefined) {
    fallar(respuesta, 404, `no existe el servicio ${parametros[0]}`);
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

export function retirar({ respuesta, parametros }: Contexto): void {
  if (!retirarServicio(Number(parametros[0]))) {
    fallar(respuesta, 404, `no existe el servicio ${parametros[0]}`);
    return;
  }
  enviarVacio(respuesta, 204);
}

export function pedirRevision({ respuesta, parametros }: Contexto): void {
  const servicio = buscarServicio(Number(parametros[0]));
  if (servicio === undefined) {
    fallar(respuesta, 404, `no existe el servicio ${parametros[0]}`);
    return;
  }
  const revision = crearRevision(servicio.id);
  setTimeout(async () => {
    terminarRevision(revision.id, await revisar(servicio.url, servicio.limiteMs));
  }, ESPERA_EN_COLA_MS);
  enviarJson(respuesta, 202, representarRevision(revision), { Location: `/revisiones/${revision.id}` });
}

export function consultarRevision({ respuesta, parametros }: Contexto): void {
  const revision = buscarRevision(Number(parametros[0]));
  if (revision === undefined) {
    fallar(respuesta, 404, `no existe la revisión ${parametros[0]}`);
    return;
  }
  const cabeceras: Cabeceras = revision.estado === "pendiente" ? { "Retry-After": "1" } : {};
  enviarJson(respuesta, 200, representarRevision(revision), cabeceras);
}
```

`listar` é a mais simples de toda a API: monta `{"servicios": […]}` com a representação de cada serviço e responde `200`. Repare em `representar`: o armazenamento guarda `limiteMs`, mas a API o expõe como `limite_ms`, e não expõe `equipo` nem `version`. A representação é uma decisão de design, separada de como os dados são guardados: no dia em que o armazenamento mudar, a API pode continuar informando o mesmo formato. Os campos usam `snake_case` porque assim são mantidos ao longo de todo o curso, e o importante é que não mudem de uma rota para outra.

A resposta de `listar` é a que se viu em 1.1.4: `{"servicios": […]}` com os três serviços iniciais e um `200`. `consultar`, a outra rota do `200`, aparece em 1.5.2 e se completa em 1.8, por ser a que interpreta as etiquetas.

### 1.5 `201`: criar e indicar onde ficou

#### 1.5.1 A pergunta decisiva

A [RFC 9110, seção 15.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.2), define o `201 Created` assim: a requisição foi atendida com sucesso e **criou um ou mais recursos novos**. E especifica como o recurso principal é identificado: pelo cabeçalho `Location` da resposta ou, se este não estiver presente, pelo próprio caminho da requisição. Essa segunda opção pouco se aplica a um cadastro como o do `revisor`, pois a requisição foi feita para `/servicios` e o novo serviço não fica em `/servicios`, mas sim em `/servicios/4`. Por isso, para um `POST` que cria algo, a [seção 9.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.3) é mais direta: o servidor **deveria** responder `201` com um cabeçalho `Location` que identifique o recurso criado.

A pergunta decisiva: **esta requisição criou algo que antes não existia e que possui endereço próprio?** Se sim, `201` com `Location`. Se o `POST` fez outra coisa (processar, calcular, enviar), não há recurso novo a apontar e o `201` mente.

A mesma seção 15.3.2 permite que o `201` traga validadores e indica o seu significado: pertencem ao recurso recém-criado. Por essa razão, o `revisor` envia a `ETag` do novo serviço junto com `Location`. Quem cadastra já dispõe, desde a primeira resposta, da etiqueta necessária para uma requisição condicional como as demonstradas na seção 1.8.

#### 1.5.2 No `revisor`

`darDeAlta` lê o corpo, com o limite de 16 KiB da seção 1.2.2, e faz cinco perguntas em ordem: é JSON?, é um **objeto** JSON?, traz `nombre` e `url` como textos?, `limite_ms`, se informado, é um inteiro razoável?, a URL é um destino permitido? (a seção 1.10 explica o motivo). Se tudo for aprovado, cria o serviço e responde `201` com dois cabeçalhos: `Location`, com o endereço do novo serviço, e `ETag`, com a respectiva etiqueta. O corpo é a representação do novo serviço, a mesma que seria retornada por um `GET` para esse endereço; a RFC estabelece que o corpo de um `201` normalmente descreve o recurso criado e fornece links para ele.

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/4
ETag: "4-1-7b2497d9"
Content-Type: application/json
Content-Length: 90
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

`-X POST` informa ao `curl` qual método utilizar, `-H` adiciona o cabeçalho `Content-Type` e `-d` envia o corpo. O serviço se chama `inventario`, aponta para o laboratório e não traz `limite_ms`, de modo que o `revisor` atribuiu o valor padrão, 2000. É o serviço 4 porque os três iniciais ocupam o 1, o 2 e o 3, e a respectiva etiqueta é `"4-1-7b2497d9"`: serviço 4, versão 1, e o identificador desta inicialização (a execução local terá outro valor).

Agora segue-se o endereço de `Location`:

```text
$ curl -i http://127.0.0.1:18080/servicios/4
HTTP/1.1 200 OK
ETag: "4-1-7b2497d9"
Content-Type: application/json
Content-Length: 90
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

O mesmo corpo, a mesma `ETag`. `Location` é uma **referência relativa**, `/servicios/4`, sem servidor nem porta. A [RFC 9110, seção 10.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.2), permite isso: se o valor for relativo, ele é completado com o endereço da requisição original. É exatamente o que o `curl` faz ao seguir um redirecionamento relativo, e o que `new URL(location, base)` faz em um programa, como será visto na seção 1.6.

`limite_ms` tem um intervalo válido, de 100 a 10000 milissegundos. Sem isso, alguém poderia cadastrar um serviço com limite de uma hora, e cada revisão deixaria o `revisor` esperando uma hora por um serviço que não responde; com limite zero, seria considerado fora do ar sem nem ter sido consultado. Fora desse intervalo, o cadastro não é realizado:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"eterno","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3600000}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 47
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

limite_ms debe ser un entero entre 100 y 10000
```

Esse `400` faz parte da rede de segurança mencionada em «O que esta lição não faz»: o `revisor` não cria um serviço com dados que não pode cumprir, e não responde `200` quando nada fez. Se parecer que «dá para ler, mas não dá para cumprir» soa mais como `422` do que `400`, esse raciocínio está correto, e é exatamente a política definida na Lição 3. Por enquanto, o `revisor` não implementa o `422`.

Resta a segunda pergunta da lista, aquela que parece excessiva: é um **objeto** JSON? `null` é um JSON válido, assim como `7`, `"texto"` ou `[]`, e `JSON.parse` aceita todos sem reclamar. Mas nenhum deles traz campos, e ler `datos.nombre` sobre `null` dispararia um `TypeError`. Sem essa pergunta, e sem a rede de `servidor.ts`, essa requisição derrubaria o `revisor` para todos, com um único comando `curl` e sem credencial alguma. Com a pergunta:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d 'null'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 31
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo no es un objeto JSON
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios
200
```

`400` com o motivo, e a requisição seguinte responde `200`: o `revisor` continua no ar. A validação e a rede de segurança não são a mesma coisa. A validação transforma um corpo inútil em um `400` que informa ao cliente o que corrigir; a rede de segurança captura o que ninguém previu e converte em um `500`, que não diz ao cliente nada útil. A validação é a prática correta; a rede é o seguro para o que escapar.

Antes dessas cinco perguntas vem o limite. Um corpo de 20000 bytes, mais que os 16384 que o `revisor` aceita:

```text
$ head -c 20000 /dev/zero | curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' --data-binary @-
HTTP/1.1 413 Content Too Large
Connection: close
Content-Type: text/plain; charset=utf-8
Content-Length: 30
Date: Wed, 21 Oct 2026 23:42:10 GMT

el cuerpo pasa de 16384 bytes
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios
200
```

`413`, com `Connection: close`, sem que o `revisor` guardasse um único byte do corpo: `Content-Length` anunciava 20000 e bastou ler o cabeçalho. A requisição seguinte responde `200`. `head -c 20000 /dev/zero` produz 20000 bytes zerados, e `--data-binary @-` diz ao `curl` que envie como corpo, tal como está, o que chega a ele pelo pipe.

> **Pausa da sessão.** Se a lição for dividida em duas sessões de 45 minutos, este é o momento. Pare o `revisor` e o laboratório com `Ctrl`+`C`. Ao retornar, inicie ambos e cadastre novamente o serviço `inventario` com o `curl` de 1.5.2: como o armazenamento vive em memória, ao reiniciar tudo é perdido, e a seção 1.7 remove o serviço 4. Se a lição for feita de uma só vez, faça o mesmo: interrompa os dois, inicie-os e repita o cadastro, para que os números coincidam com os da lição. A resposta é a mesma de 1.5.2, exceto pela etiqueta, por se tratar de outra inicialização:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/4
ETag: "4-1-b27b3d9a"
Content-Type: application/json
Content-Length: 90
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

### 1.6 `202`: aceito, mas ainda não concluído

#### 1.6.1 A pergunta decisiva

Solicitar uma revisão não é algo resolvido instantaneamente. O `revisor` precisa consultar o serviço, e um serviço lento pode demorar segundos para responder; em um sistema real, as revisões aguardam a sua vez em uma fila. Manter a conexão aberta durante esse tempo seria uma péssima ideia: o cliente fica travado e, se a conexão cair, não sabe se a revisão foi realizada.

Para isso existe o `202 Accepted`. A [RFC 9110, seção 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.3), define-o com uma franqueza incomum: a requisição foi aceita para processamento, mas **o processamento ainda não terminou**, e talvez nunca venha a ser concluído, já que pode ser rejeitado quando chegar a vez na fila. O texto afirma que o `202` é «intencionalmente vago» (*intentionally noncommittal*). E acrescenta que no HTTP não há como o servidor enviar posteriormente outro código de status para a mesma requisição: a resposta já foi dada. Por isso termina com uma recomendação fundamental nesta seção: a representação do `202` **deveria** descrever o estado atual da requisição e apontar para um **monitor de status** (*status monitor*) no qual o cliente possa verificar quando a operação for concluída.

A pergunta decisiva: **a operação vai terminar depois que a resposta for enviada?** Se sim, `202`, e nunca `200` nem `201`, pois ambos dizem ao cliente que tudo já foi finalizado.

#### 1.6.2 O recurso de acompanhamento

No `revisor`, esse monitor de status é um recurso próprio: cada revisão fica em `/revisiones/{id}`. `pedirRevision` cria a revisão no estado `pendiente`, agenda a execução para dali a um segundo com `setTimeout` (o segundo de «espera na fila», que torna visível o estado pendente) e responde `202` com duas informações: um corpo descrevendo o estado atual e um cabeçalho `Location` apontando para a revisão. É o mesmo cabeçalho do `201`, mas com outro significado: no `201` indica o que foi criado; no `202`, indica onde consultar.

`consultarRevision` responde `200` com o estado da revisão. Enquanto estiver pendente, adiciona `Retry-After: 1`. A [RFC 9110, seção 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3), define `Retry-After` como o tempo que o cliente deveria aguardar antes da próxima requisição, em segundos ou com uma data; a RFC descreve o cabeçalho para o `503` e redirecionamentos, e em um recurso de acompanhamento ele cumpre o mesmo papel: «não retorne antes de um segundo». O uso pelo `revisor` aqui é uma decisão de design, não uma exigência normativa; a norma apenas define o significado do cabeçalho.

Solicite uma revisão do serviço 2, `pagos`, que aponta para `/codigo/503`:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones
HTTP/1.1 202 Accepted
Location: /revisiones/1
Content-Type: application/json
Content-Length: 60
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"servicio":2,"estado":"pendiente","resultado":null}
```

E logo em seguida, sem esperar, acesse o `Location`:

```text
$ curl -i http://127.0.0.1:18080/revisiones/1
HTTP/1.1 200 OK
Retry-After: 1
Content-Type: application/json
Content-Length: 60
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"servicio":2,"estado":"pendiente","resultado":null}
```

`200`, porque a consulta de acompanhamento foi bem-sucedida: aqui está o que foi solicitado, o estado da revisão. O estado é `pendiente`, e `Retry-After: 1` diz quando retornar. Este ponto costuma gerar confusão no início: **o `202` descreve a requisição de revisão; o `200` descreve a consulta de acompanhamento**. São duas requisições distintas, cada uma com código próprio.

Dois segundos depois:

```text
$ sleep 2
$ curl -i http://127.0.0.1:18080/revisiones/1
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 111
Date: Wed, 21 Oct 2026 13:17:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"servicio":2,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":503,"ms":11,"detalle":"503"}}
```

Concluída. O resultado indica que `pagos` está `CAIDO`, com o código `503` retornado pelo laboratório e os milissegundos que levou (na execução local, outro número). O cabeçalho `Retry-After` já não vem mais, pois não há mais nada a esperar.

#### 1.6.3 O lado cliente

Quem consultou `pagos`? O lado cliente do `revisor`:

```ts
// fig01_01/cliente.ts — la cara cliente del revisor: consulta un servicio y clasifica lo que respondió.
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

`revisar` recebe a URL e o limite. O primeiro passo é verificar novamente o destino (a seção 1.10 explica por que isso é feito antes de **cada** conexão). Em seguida, mede o tempo com `performance.now()`, faz a consulta com `fetch` e classifica. Se o código for `400` ou superior, `CAIDO`. Caso contrário, `LENTO` se tiver demorado metade do limite ou mais, e `ARRIBA` se demorou menos. Se o `fetch` não obteve resposta, `CAIDO` com um detalhe que distingue «tempo esgotado» de «sem conexão»; é a diferença entre o erro 7 do `curl` e uma resposta HTTP, vista ao final da Lição 0.

Três detalhes do `fetch`. `AbortSignal.timeout(limiteMs)` interrompe a consulta se ultrapassar o limite. `respuesta.body?.cancel()` descarta o corpo sem lê-lo, pois para a classificação apenas o número importa: é o princípio «o código manda» aplicado do lado de quem lê. E `redirect: "manual"` instrui o `fetch` a **não seguir** redirecionamentos: se um serviço responder `301`, o `revisor` registra o `301` e não navega para onde o `Location` aponta. Essa decisão envolve motivos de segurança e será detalhada no quadro.

#### 1.6.4 Um cliente que sabe esperar

Com o `curl`, o `202` foi acompanhado manualmente. Um programa precisa fazer isso de forma autônoma, e a tentação imediata é consultar em um laço contínuo sem pausas até receber `terminada`. Este programa faz isso da forma correta. Salve-o como `~/curso-http/revisor/fig01_02.ts`:

```ts
// fig01_02.ts
// Pide una revisión y la sigue como debe hacerlo quien recibe un 202: va a Location y respeta Retry-After.
import { setTimeout as esperar } from "node:timers/promises";

const BASE = "http://127.0.0.1:18080";
const servicio = process.argv[2] ?? "2";

const pedido = await fetch(`${BASE}/servicios/${servicio}/revisiones`, { method: "POST" });
await pedido.text();
const seguimiento = pedido.headers.get("location");
console.log(`${pedido.status} ${pedido.statusText}; seguimiento en ${seguimiento}`);
if (pedido.status !== 202 || seguimiento === null) process.exit(1);

type Revision = { estado: "pendiente" | "terminada"; resultado: unknown };

for (let consulta = 1; consulta <= 10; consulta++) {
  const respuesta = await fetch(new URL(seguimiento, BASE));
  const revision = (await respuesta.json()) as Revision;
  const pide = respuesta.headers.get("retry-after");
  console.log(`consulta ${consulta}: ${respuesta.status} ${revision.estado}${pide === null ? "" : `, Retry-After: ${pide}`}`);
  if (revision.estado === "terminada") {
    console.log(`resultado: ${JSON.stringify(revision.resultado)}`);
    break;
  }
  // Espera lo que pide el servidor, entre 1 y 5 segundos: ni martilla ni se queda dormido.
  const segundos = Math.min(Math.max(Number(pide) || 1, 1), 5);
  await esperar(segundos * 1000);
}
```

Lê-se a resposta do `202` e extrai-se o `Location`; se o código não for `202` ou o cabeçalho estiver ausente, o programa para, pois não saberia onde consultar. Em seguida, consulta o acompanhamento: `new URL(seguimiento, BASE)` completa a referência relativa com o servidor e a porta, conforme preconiza a RFC. Em cada iteração imprime o estado e, se presente, `Retry-After`. Quando a revisão termina, imprime o resultado e encerra. Caso contrário, aguarda o intervalo solicitado pelo servidor, **delimitado entre 1 e 5 segundos**, e volta a consultar. Ambos os limites são decisões do cliente, não da RFC: o limite inferior evita sobrecarregar o servidor se `Retry-After` faltar ou não for um número, e o superior impede que um servidor com problemas deixe o programa parado por uma hora. A [Lição 6](06-reintentos-idempotencia.md) retoma esse limite superior, e a [Lição 7](07-quien-lee-el-error.md) aborda o que fazer quando o servidor pede para esperar mais do que se está disposto. O laço traz ainda um teto de dez consultas, para que um acompanhamento que nunca termine não mantenha o programa rodando indefinidamente.

Com o laboratório e o `revisor` em execução, solicite uma revisão do serviço 1, `catalogo`:

```text
$ node fig01_02.ts 1
202 Accepted; seguimiento en /revisiones/2
consulta 1: 200 pendiente, Retry-After: 1
consulta 2: 200 terminada
resultado: {"estado":"ARRIBA","codigo":200,"ms":1,"detalle":"200"}
```

Duas consultas. A primeira encontrou a revisão pendente e respeitou o `Retry-After`; a segunda, um segundo depois, encontrou-a terminada: `catalogo` está `ARRIBA`. No terminal do `revisor` ficaram três linhas, o `POST` e os dois `GET`. Conte as consultas feitas pelo programa: se foram cinco mil, faltou a pausa.

### 1.7 `204`: pronto, sem nada mais a informar

#### 1.7.1 A pergunta decisiva

A [RFC 9110, seção 15.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.5), define o `204 No Content`: o servidor atendeu à requisição e **não tem conteúdo adicional** para enviar. E é taxativa quanto ao formato: um `204` termina com o último cabeçalho e **não pode** conter corpo.

A pergunta decisiva: **a operação terminou e não há nada útil a informar?** Uma remoção é o caso clássico. Para um `DELETE` bem-sucedido, a [seção 9.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.5) oferece exatamente três opções: `202` se a ação provavelmente vai ocorrer mas ainda não ocorreu; `204` se já ocorreu e não há mais informações; e `200` se já ocorreu e a resposta traz uma representação do estado. O `revisor` remove no momento da requisição e não tem nada a relatar, portanto responde `204`.

E por que não `200` com corpo vazio ou com `{"ok": true}`? Porque o `204` informa a qualquer programa, sem necessidade de ler nada, que não há corpo a esperar. Um `200` com `{"ok": true}` obriga o cliente a analisar o corpo para descobrir algo que o código já expressava. E um `200` vazio é válido se declarar `Content-Length: 0`, mas força o cliente a verificar o tamanho para ter certeza de que não há nada, quando o `204` já afirma isso diretamente no código.

#### 1.7.2 No `revisor`

`retirar` apaga o serviço do armazenamento e responde com `enviarVacio`. Se o serviço não existia, responde `404`. Remova o serviço 4:

```text
$ curl -i -X DELETE http://127.0.0.1:18080/servicios/4
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

Nem `Content-Type` nem `Content-Length`: não há corpo a descrever. Peça o serviço novamente:

```text
$ curl -i http://127.0.0.1:18080/servicios/4
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 4
```

O serviço já não existe, e o `revisor` indica isso com um `404` e uma linha de texto. (Na Lição 3, um serviço removido responderá `410`, que significa «existiu e não existe mais»; hoje o `revisor` não se lembra do que removeu.) E ao repetir a remoção:

```text
$ curl -i -X DELETE http://127.0.0.1:18080/servicios/4
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 4
```

O segundo `DELETE` responde de forma diferente do primeiro, e ainda assim o `DELETE` é **idempotente**. A [RFC 9110, seção 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2), define um método idempotente pelo seu **efeito no servidor**, não pela resposta: repetir a requisição deixa o servidor no mesmo estado em que uma única requisição o deixaria. Depois de um ou de dez `DELETE`, o serviço 4 não existe. Essa propriedade constitui a base da Lição 6, pois é ela que permite efetuar novas tentativas sem receio.

### 1.8 `304`: não enviar o que o cliente já tem

#### 1.8.1 A pergunta decisiva

Imagine um painel que exibe os serviços e os consulta a cada dez segundos. Na grande maioria das vezes nada mudou, e o `revisor` enviaria o mesmo corpo repetidamente. Para isso existem as **requisições condicionais**: o cliente afirma «já possuo a versão identificada por esta etiqueta; envie-a apenas se tiver mudado». O cabeçalho é `If-None-Match` («se nenhuma coincidir»), e carrega a `ETag` armazenada pelo cliente.

A [RFC 9110, seção 13.1.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2), determina como essa condição é avaliada: se uma das etiquetas enviadas pelo cliente coincidir com a do recurso, a condição é falsa e, portanto, o servidor **não deve** executar o método: para um `GET` ou um `HEAD` responde `304`, e para qualquer outro método, `412` (a Lição 3 trata do `412`). Se nenhuma coincidir, o servidor responde normalmente com o `200`.

A [RFC 9110, seção 15.4.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.5), define o `304 Not Modified`: a requisição condicional resultaria em um `200`, mas não é necessário enviar a representação porque **o cliente já a possui**. O servidor, afirma a RFC, está «redirecionando» o cliente para a própria cópia armazenada em cache. Por isso o `304` pertence à família `3xx`, embora não contenha `Location`: é um redirecionamento para o que já se tem em mãos. E, assim como o `204`, encerra-se com o último cabeçalho: **não pode** conter corpo.

O que ele obrigatoriamente deve conter é a parte frequentemente esquecida. A RFC fornece uma lista sucinta: `Content-Location`, `Date`, `ETag` e `Vary`, além de `Cache-Control` e `Expires`; `Content-Length` pode acompanhá-los somente se disser o mesmo que o `200` teria dito (seção 8.6), e o `revisor` prefere não enviá-lo. Desses cabeçalhos, um `304` **deve** gerar os mesmos que teriam sido enviados em um `200` para a mesma requisição. A `ETag` é a mais importante aqui: ela confirma ao cliente qual é a versão vigente.

A pergunta decisiva, do lado do servidor: **a versão informada pelo cliente é a versão vigente?** Se sim, `304` e nada mais. Se não, `200` com a nova versão e a respectiva etiqueta.

#### 1.8.2 Ler uma lista de etiquetas

A seção 13.1.2 traz dois detalhes fundamentais que orientam como o código deve ser escrito. O primeiro: `If-None-Match` não traz **uma única** etiqueta, mas sim `*` ou **uma lista** separada por vírgulas (`If-None-Match: "a", "b"`), pois um cliente pode ter várias versões armazenadas e consultar todas de uma só vez; e `*` significa «qualquer versão existente». O segundo: a comparação é **fraca**. A [seção 8.8.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.2) define duas formas de comparar etiquetas. Na **forte**, duas etiquetas coincidem apenas se nenhuma delas contiver o prefixo `W/` (o indicador de «fraca») e o texto for idêntico. Na **fraca**, basta que o texto entre aspas seja igual, com ou sem `W/`. `If-None-Match` utiliza a comparação fraca, porque apenas pergunta se a cópia do cliente ainda serve para exibição. A Lição 3 utiliza a forte, com `If-Match`, para operações mais delicadas.

Comparar o cabeçalho inteiro diretamente com a etiqueta, como texto simples, falha em ambos os casos, e é por isso que existe `etiquetas.ts`:

```ts
// fig01_01/etiquetas.ts — leer y comparar etiquetas (ETag) como pide el RFC 9110.
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

`interpretarLista` percorre o cabeçalho respeitando as aspas: uma vírgula **dentro** das aspas faz parte da etiqueta, não sendo um separador. Retorna `"*"` ou a lista de etiquetas exatamente como chegaram. Se algum elemento não tiver o formato de etiqueta, a lista inteira é invalidada e retorna-se uma lista vazia, que não coincide com nada. É uma decisão prudente: diante de um cabeçalho malformado, o servidor responde com a representação completa, o que nunca é incorreto. `coincideDebil` e `coincideFuerte` comparam duas etiquetas. `hayCoincidencia` integra ambas as partes: `*` coincide sempre (quem a chama já localizou o recurso), e uma lista coincide se **alguma** das etiquetas da lista for equivalente à vigente.

#### 1.8.3 No `revisor`

`consultar`, em `servicios.ts`, calcula a etiqueta vigente e pergunta a `hayCoincidencia`, com a comparação fraca, se o cabeçalho `If-None-Match` a contém. Se contiver, `enviarVacio(respuesta, 304, { ETag: actual })`; caso contrário, o `200` habitual. Consulte o serviço 1, `catalogo`, e observe a respectiva `ETag`:

```text
$ curl -i http://127.0.0.1:18080/servicios/1
HTTP/1.1 200 OK
ETag: "1-1-b27b3d9a"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

Agora consulte com essa mesma etiqueta. Copie a etiqueta retornada localmente, com as aspas:

```text
$ curl -i http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: "1-1-b27b3d9a"'
HTTP/1.1 304 Not Modified
ETag: "1-1-b27b3d9a"
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

`304`, com a `ETag` e sem corpo, sem `Content-Type` e sem `Content-Length`: os 88 bytes do corpo não trafegaram. Neste serviço de demonstração isso parece insignificante; em uma lista com milhares de serviços consultada a cada dez segundos por cem painéis, é a diferença entre transmitir megabytes por minuto ou quase nada.

Compare isso com um `HEAD`, que também chega sem corpo, mas por outra razão:

```text
$ curl -I http://127.0.0.1:18080/servicios/1
HTTP/1.1 200 OK
ETag: "1-1-b27b3d9a"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

`200` com `Content-Length: 88`: o `HEAD` indica quanto mediria o corpo, assim como na Lição 0. O `304` não declara nada semelhante, pois não responde a «como é o recurso?», mas sim a «o recurso mudou?».

Os outros três formatos permitidos pela RFC, usando `-w '%{http_code}\n'` para exibir apenas o código: a etiqueta com prefixo de fraca, uma lista que a contém e o asterisco.

```text
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: W/"1-1-b27b3d9a"'
304
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: "9-9-00000000", "1-1-b27b3d9a"'
304
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: *'
304
```

Os três retornam `304`. O `W/` não altera o resultado em uma comparação fraca; a lista coincide porque uma de suas etiquetas é correspondente; e `*` coincide porque o serviço existe.

#### 1.8.4 A etiqueta muda a cada inicialização

Pare o `revisor` (deixando o laboratório em execução) e inicie-o novamente. Em seguida, consulte o serviço 1 com a etiqueta anterior:

```text
$ curl -i http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: "1-1-b27b3d9a"'
HTTP/1.1 200 OK
ETag: "1-1-ed399d6d"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

`200`, com o corpo completo e uma nova etiqueta. O serviço 1 é o mesmo `catalogo` e nada mudou nele, mas o `revisor` não tem como saber disso: perdeu todo o estado ao reiniciar e recriou os registros. Na dúvida, envia a representação completa e uma etiqueta impossível de ser confundida com qualquer outra anterior. É o identificador de inicialização da seção 1.2.1 cumprindo seu papel. Sem ele, a etiqueta antiga e a nova seriam ambas `"1-1"`, e um `304` confirmaria ao cliente uma cópia que o servidor já não pode garantir. Um servidor que armazena dados em um banco de dados não enfrenta esse problema, pois o versionamento sobrevive a reinicializações. O `revisor` resolve isso com a solução mais simples que funciona.

### 1.9 `301` e `308`: migrar sem perder o `POST`

#### 1.9.1 A pergunta decisiva

APIs mudam de lugar. O `revisor` teve duas rotas antigas, `/viejo/servicios` e `/api/servicios`, que hoje ficam em `/servicios`. Para comunicar isso existem dois códigos permanentes, e a diferença entre eles é histórica.

A [RFC 9110, seção 15.4.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.2), define o `301 Moved Permanently`: o recurso recebeu um novo endereço permanente, e o servidor **deveria** informá-lo em `Location`. E traz uma nota central para esta seção: **por razões históricas, um cliente pode alterar o método de `POST` para `GET`** na requisição seguinte. A mesma nota apresenta a solução: se essa alteração não for desejada, utiliza-se o `308`.

A introdução da [seção 15.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4) relata a história completa. No HTTP/1.0, o `301` e o `302` preservavam o método. Mas os primeiros navegadores divergiram: alguns repetiam o `POST` no novo endereço e outros o convertiam em `GET`, comportamento mais prudente caso o redirecionamento levasse a outro site. A prática consolidou a conversão para `GET`, e a especificação adaptou-se para permitir isso. Para os redirecionamentos que **devem** preservar o método, novos códigos foram criados: o `307`, temporário, e o `308 Permanent Redirect`, definido pela [RFC 7238](https://www.rfc-editor.org/rfc/rfc7238.html) em junho de 2014 como experimental, padronizado pela [RFC 7538](https://www.rfc-editor.org/rfc/rfc7538.html) em abril de 2015, e hoje presente na [seção 15.4.9](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.9) da RFC 9110.

Os clientes comumente utilizados seguem essa convenção rigorosamente. O manual do `curl` afirma que, ao seguir um redirecionamento com `-L`, se a requisição original foi um `POST` e a resposta foi `301`, `302` ou `303`, a requisição subsequente será convertida em `GET`; com qualquer outro `3xx`, repete o mesmo método. E a [especificação Fetch](https://fetch.spec.whatwg.org/#http-redirect-fetch), seguida pelo `fetch` no Node e nos navegadores, estabelece o mesmo em seu algoritmo de redirecionamento: se o código for `301` ou `302` e o método for `POST`, o método torna-se `GET` e **o corpo é descartado**.

A pergunta decisiva: **alguém pode enviar para esta rota antiga algo diferente de um `GET` ou `HEAD`?** Se a resposta for nunca, o `301` é suficiente e compreendido até pelos clientes mais antigos. Se for possível receber um `POST`, `PUT` ou `DELETE`, deve-se usar `308`. A RFC 7538, na seção 4, acrescenta uma ressalva: um cliente muito antigo que não reconheça o `308` vai tratá-lo como `300`, pela regra do `x00` da Lição 0, e pode não seguir o redirecionamento; o servidor não pode presumir que ele será seguido. Hoje isso é raro, mas explica por que o `301` continua sendo a escolha padrão para rotas exclusivamente de leitura.

Mudanças de rota não são apenas exemplos teóricos. A página da OWASP citada no quadro de segurança desta lição mudou de endereço e, ao consultá-la na URL antiga com `-I` (apenas cabeçalhos) e `-L` (seguir), vê-se a migração completa, em três saltos:

```text
$ curl -sS -I -L https://owasp.org/API-Security/editions/2023/en/0xa7-server-side-request-forgery/ | grep -i -E '^HTTP|^location'
HTTP/2 308 
location: /API-Security/editions/2023/en/0xa7-server-side-request-forgery
HTTP/2 308 
location: https://api-security.owasp.org/editions/2023/en/0xa7-server-side-request-forgery
HTTP/2 301 
location: https://api-security.owasp.org/editions/2023/en/0xa7-server-side-request-forgery/
HTTP/2 200 
```

Dois `308` e um `301` antes do `200`: o primeiro remove a barra final, o segundo migra a página para outro domínio e o terceiro a reinsere. Esta execução foi realizada em 21 de outubro de 2026 e está guardada, tal como foi obtida, em `programas/01-exitos-redirecciones/owasp.salida.txt`, e um site externo pode alterar seus redirecionamentos a qualquer momento, de modo que a saída observada localmente pode variar. As linhas indicam `HTTP/2` e não trazem frase de status porque essa conexão usou HTTP/2, protocolo que não envia a frase da linha de status — como visto na Lição 0, um cliente nunca deve tomar decisões com base nessa frase.

Há um terceiro código frequentemente mencionado, o `302 Found`, e convém entender onde ele se situa. Carrega a mesma ressalva histórica do `301` (um `POST` pode virar `GET`), porém é **temporário**: o cliente deve continuar usando o endereço original. Seu par correspondente que preserva o método é o `307`. O `revisor` não os utiliza porque suas migrações são definitivas; o laboratório os gera em `/codigo/302` e `/codigo/307` para quem quiser inspecioná-los.

#### 1.9.2 No `revisor`

`redirigir`, em `rutas.ts`, verifica a rota **antes** da tabela, impedindo que uma rota antiga chegue a um *handler*. Para `/viejo/servicios` e tudo o que descende dela, responde `301`; para `/api/servicios` e descendentes, `308`. Em ambos os casos, `Location` aponta para a nova rota: remove-se o prefixo e preservam-se os parâmetros de consulta (o que vem após `?`), garantindo que um `GET /viejo/servicios?x=1` chegue a `/servicios?x=1`.

Sem `-L`, o `curl` apenas exibe a resposta recebida, sem segui-la. Envie um cadastro para cada rota antiga:

```text
$ curl -i -X POST http://127.0.0.1:18080/viejo/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 301 Moved Permanently
Location: /servicios
Content-Length: 0
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
$ curl -i -X POST http://127.0.0.1:18080/api/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 308 Permanent Redirect
Location: /servicios
Content-Length: 0
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

Ambas as respostas dizem o mesmo, exceto pelo número: «isto mudou-se para `/servicios`», com `Content-Length: 0`. Nenhuma das duas criou recurso algum. O que acontece em seguida depende do cliente, e é exatamente isso que a seção «O erro a ser observado» demonstra.

### 1.10 Quadro de segurança: SSRF

> **Quadro de segurança. O que é SSRF e por que o `revisor` traz isso de nascença**
>
> **SSRF** (*server-side request forgery*, falsificação de requisição do lado do servidor) é o que ocorre quando alguém consegue fazer com que **o próprio servidor** emita uma requisição para um destino escolhido por **essa pessoa**. O servidor conecta-se a partir da própria rede interna, com as permissões de acesso atribuídas ao processo, alcançando endereços inacessíveis externamente pelo atacante: o próprio servidor (`127.0.0.1`), a rede corporativa interna ou o serviço de metadados da nuvem. O [OWASP API Security Top 10 de 2023](https://api-security.owasp.org/editions/2023/en/0xa7-server-side-request-forgery/) o posiciona em sétimo lugar (API7:2023) e o define assim: uma API que obtém um recurso remoto **sem validar a URL fornecida pelo usuário**. E esclarece por que se tornou tão comum: *webhooks*, pré-visualizações de links e download de arquivos a partir de URLs são funcionalidades de produto que consistem justamente em conectar-se a endereços externos.
>
> **O `revisor` é o caso típico.** O propósito do `revisor` é conectar-se à URL cadastrada por quem registrou o serviço. Não se trata de um descuido a ser removido: é o próprio produto. Sem nenhuma proteção, qualquer pessoa com permissão de cadastro poderia registrar `http://127.0.0.1:18080/mantenimiento` e fazer com que o `revisor` consultasse a si mesmo, ou um endereço da rede interna visível apenas para o servidor, e depois ler o resultado da revisão: `ARRIBA`, `CAIDO`, o código de status e os milissegundos. Com isso já é possível mapear quais máquinas e portas estão ativas dentro da rede. E se o `revisor` rodar em nuvem, há um endereço mais valioso do que todos os outros: `169.254.169.254`, onde diversas nuvens disponibilizam os **metadados** da instância. A [documentação da AWS](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html) usa esse endereço em todos os seus exemplos (e `[fd00:ec2::254]` em IPv6), a do [Alibaba Cloud](https://www.alibabacloud.com/help/en/ecs/user-guide/view-instance-metadata) utiliza outro, `100.100.100.200`, e o [guia de prevenção de SSRF da OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) é categórico: na nuvem, SSRF é frequentemente explorado para roubar credenciais e tokens desses serviços de metadados.
>
> **A defesa: consultar o DNS antes de cada conexão.** Analisar apenas o texto da URL não basta. `localhost` não se parece com um endereço restrito, mas é; `http://2130706433/` tampouco parece, e o analisador de URLs o converte para `127.0.0.1`, pois a [especificação de URL](https://url.spec.whatwg.org/#concept-ipv4-parser) aceita endereços IPv4 expressos como um único número inteiro, em formato hexadecimal ou octal. O que importa não é como o destino é escrito, mas sim **a qual endereço IP o `revisor` vai se conectar**. Por isso `destinos.ts` adota três medidas: deixa que `new URL` normalize o endereço; resolve o nome com `dns.lookup` e a opção `all: true`, que retorna **todos** os endereços associados àquele host, exatamente como qualquer outro programa da máquina resolveria (incluindo `/etc/hosts`); e rejeita o destino se **ao menos um** deles pertencer a uma faixa privada ou reservada. As faixas são verificadas com `net.BlockList` do Node, e um IPv4 embutido em um IPv6 (`::ffff:127.0.0.1`) é extraído e inspecionado como tal. E essa checagem é executada **duas vezes**: ao cadastrar a URL, para alertar quem a inseriu, e novamente em `cliente.ts`, **antes de cada conexão**, porque o endereço ao qual um domínio resolvia na sexta-feira não é necessariamente o mesmo da segunda-feira. Observe também o que a mensagem de rejeição **não** diz: a mensagem não revela para qual IP o nome resolveu, evitando conceder ao atacante um mapa da rede interna requisição por requisição. O endereço específico, se necessário para diagnóstico, deve constar apenas no log do servidor, acessível a quem opera o `revisor`.
>
> **A exceção do laboratório.** O ambiente de laboratório deste curso fica em `127.0.0.1:18081`, que é loopback, uma faixa proibida. Sem uma exceção explícita, não seria possível praticar em uma única máquina. Por esse motivo existe uma lista de destinos permitidos **por endereço e porta exatos**: por padrão apenas `127.0.0.1:18081`, configurável por meio da variável de ambiente `REVISOR_DESTINOS`. Essa lista é restrita de propósito: `127.0.0.1:18080`, o próprio `revisor`, continua bloqueado. E `localhost:18081` depende da máquina: se `localhost` resolver também para `::1`, como ocorre no macOS e em muitas distribuições Linux, é rejeitado, porque `[::1]:18081` não consta na lista permitida; se resolver exclusivamente para `127.0.0.1`, é aceito, pois `127.0.0.1:18081` é exatamente a exceção configurada. Essa distinção reforça o motivo pelo qual a lista é baseada em endereço e não em nome: o que um nome resolve não depende de quem escreveu a regra. Em um `revisor` em produção, essa lista estaria vazia ou conteria estritamente o indispensável, e a regra geral (bloquear qualquer endereço privado) cuidaria do restante. Uma lista de permissões (*allowlist*) é mais segura que uma lista de bloqueios (*denylist*), e a OWASP a recomenda sempre que os destinos forem previamente conhecidos; aqui eles não são, pois qualquer usuário pode cadastrar qualquer serviço, e por isso combinam-se ambas as estratégias.
>
> **Por que o `fetch` não segue redirecionamentos.** Se `cliente.ts` seguisse códigos `3xx`, bastaria cadastrar um serviço público que respondesse `301` com `Location: http://169.254.169.254/…`: a URL cadastrada passaria na validação inicial e o redirecionamento conduziria o `revisor` a um destino proibido, sem passar por `destinos.ts`. Com `redirect: "manual"`, o `revisor` apenas registra o `301` e interrompe a requisição. A OWASP e o API Top 10 recomendam expressamente essa prática: desativar o acompanhamento automático de redirecionamentos.
>
> **O limite declarado: DNS rebinding.** Mesmo validando antes de cada `fetch`, resta uma brecha que deve ser mencionada com clareza. `destinos.ts` resolve o nome e aprova seus endereços IP; logo em seguida, o `fetch` **resolve o nome novamente** para estabelecer a conexão. Entre uma resolução e outra passam-se milissegundos, e quem controla o servidor DNS daquele domínio pode responder com um IP público na primeira consulta e com `127.0.0.1` na segunda, configurando um TTL (tempo de vida) de zero segundos para impedir o cache da primeira resposta. Isso é denominado **DNS rebinding**, uma condição de corrida entre a validação e o uso. O guia da OWASP é enfático: uma segunda resolução não validada entre a checagem e a conexão contorna essas defesas. A proteção definitiva consiste em **conectar-se diretamente ao endereço IP já validado**, sem efetuar uma nova resolução de nome: utilizando `http.request` do Node com a opção `lookup`, uma função customizada substitui o `dns.lookup` e pode fornecer exatamente o IP aprovado, enquanto o cabeçalho `Host` preserva o nome de domínio original. **Aqui a validação ocorre antes de cada conexão, e a defesa completa chega na [Lição 8](08-contrato-verificable.md)**, onde `cliente.ts` conecta-se diretamente ao IP validado; até lá, essa limitação permanece documentada nos comentários de `destinos.ts`, para que ninguém a presuma inexistente. E mesmo com essa defesa, em produção é indispensável uma segunda camada de segurança: regras de firewall na rede que impeçam o `revisor` de acessar o serviço de metadados caso ele tente. A segurança não pode depender de um único arquivo de código.

#### 1.10.1 O código

```ts
// fig01_01/destinos.ts — a dónde puede conectarse el revisor. Defensa contra SSRF.
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

Lê-se na ordem da função `revisarDestino`. Primeiro tenta-se converter o texto em uma URL; caso não seja possível, não se trata de um destino válido. Depois exige-se `http:` ou `https:`: protocolos como `file:` ou `ftp:` não têm cabimento em um monitor de serviços web. Calcula-se a porta (a especificada na URL ou a porta padrão do protocolo) e removem-se os colchetes de um endereço IPv6 (`[::1]` → `::1`). A função `privada` determina se um endereço é privado ou reservado, procedendo de forma distinta para cada protocolo, por uma razão detalhada adiante: para um IPv4 verifica-se a presença em `IPV4_PROHIBIDAS`; para um IPv6, verifica-se primeiro se ele embute um IPv4 (os quatro formatos de `EMBEBIDAS`, com o auxílio de `grupos`, que decompõe um IPv6 em seus oito grupos de 16 bits) e, em caso negativo, se pertence a `IPV6_GLOBAL` e está fora de `IPV6_PROHIBIDAS`. Se o host já for um endereço IP, utiliza-se o valor diretamente; caso contrário, é resolvido via `lookup(nombre, { all: true })`. Ao final, monta-se cada destino como `endereço:porta`, filtrando aqueles que **não** constam na lista de permitidos **e** que `privada` classifica como privados ou reservados. Havendo qualquer correspondência, o destino é rejeitado. O motivo exibido depende de como o destino foi fornecido: se foi um endereço IP, ele é repetido na mensagem, pois foi digitado pelo próprio cliente; se foi um nome de domínio, a mensagem apenas informa que o nome resolve para um endereço privado ou reservado, sem enumerar quais.

**Uma decisão de arquitetura: lista de bloqueios no IPv4, lista de permissões no IPv6.** Existem duas abordagens para formular a regra. Uma **lista de bloqueios** (*denylist* ou lista negra) especifica o que é proibido e autoriza todo o restante; uma **lista de permissões** (*allowlist* ou lista branca) especifica o que é permitido e rejeita todo o restante. A lista de permissões é mais segura, pois o que for esquecido fica de fora por padrão. Entretanto, só é viável escrevê-la quando o conjunto permitido puder ser resumido em poucas linhas, e nesse aspecto os dois protocolos diferem radicalmente.

No **IPv6**, cabe em uma linha. Todo o tráfego unicast global da internet está em um único bloco, `2000::/3`, classificado pelo [registro de espaço de endereços IPv6 da IANA](https://www.iana.org/assignments/ipv6-address-space/) como *Global Unicast*. A regra lê-se de forma direta: «permite-se apenas a internet pública». Com ela, ficam de fora de imediato, sem necessidade de enumeração individual, o loopback `::1`, o endereço não especificado `::`, os locais únicos `fc00::/7`, o link-local `fe80::/10`, o multicast `ff00::/8` e qualquer bloco especial que venha a ser alocado futuramente fora de `2000::/3`. Dentro desse bloco há poucos intervalos não destinados à internet pública, e esses sim são listados em `IPV6_PROHIBIDAS`: `2001::/23` (protocolos do IETF, incluindo Teredo), `2001:db8::/32` e `3fff::/20` (documentação) e `5f00::/16` (*segment routing*).

No **IPv4**, não é viável fazer o mesmo. Não existe um bloco «global» passível de aceitação integral: o escopo global é definido por exclusão («tudo, exceto os especiais»), e uma lista de permissões em IPv4 equivaleria à mesma lista de bloqueios escrita ao inverso. Por essa razão, `IPV4_PROHIBIDAS` é uma lista de bloqueios transcrita linha por linha do [registro de endereços IPv4 de uso especial da IANA](https://www.iana.org/assignments/iana-ipv4-special-registry/), com a identificação de cada bloco em seus comentários, permitindo auditoria direta em relação ao registro oficial:

| Bloco IPv4 | O que é | Onde é definido |
|---|---|---|
| `0.0.0.0/8` | «esta rede» | [RFC 6890](https://www.rfc-editor.org/rfc/rfc6890.html), base do registro de uso especial |
| `10/8`, `172.16/12`, `192.168/16` | redes privadas | [RFC 1918](https://www.rfc-editor.org/rfc/rfc1918.html) |
| `100.64/10` | espaço compartilhado ou *CGNAT* (*Carrier-Grade NAT*: a tradução de endereços com a qual um provedor de internet reparte um mesmo endereço público entre muitos clientes); em `100.100.100.200` o Alibaba Cloud publica seus metadados | [RFC 6598](https://www.rfc-editor.org/rfc/rfc6598.html) |
| `127/8` | loopback, a própria máquina | RFC 6890 |
| `169.254/16` | link-local; em `169.254.169.254` a AWS e outras nuvens publicam seus metadados | [RFC 3927](https://www.rfc-editor.org/rfc/rfc3927.html) |
| `192.0.0.0/24` | atribuições de protocolo do IETF | registro da IANA |
| `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` | documentação (TEST-NET-1, 2 e 3) | registro da IANA |
| `192.88.99.0/24` | antigo relay 6to4, desativado | registro da IANA |
| `198.18.0.0/15` | testes de desempenho | registro da IANA |
| `224/4` | multicast (*multidifusão*), endereço direcionado a um grupo de máquinas | [RFC 5771](https://www.rfc-editor.org/rfc/rfc5771.html) |
| `240/4` | reservado, incluindo o broadcast `255.255.255.255` | registro da IANA |

A lista adota uma margem de segurança deliberada: `192.0.0.0/24` e `2001::/23` são bloqueados por inteiro, embora o registro marque alguns endereços isolados dentro deles como globais. Trata-se de endereços de protocolos da própria infraestrutura de rede, não de serviços web passíveis de monitoramento, e uma regra simples de uma linha é mais fácil de auditar do que uma série de exceções pontuais.

**O IPv4 embutido em um IPv6.** Quatro formatos IPv6 carregam um IPv4 internamente, e em todos eles o que importa para a segurança é esse IPv4 embutido. Assim, `destinos.ts` extrai esse endereço e o submete à lista de IPv4, **antes** de aplicar a lista de permissões:

| Formato IPv6 | Onde fica o IPv4 | Exemplo |
|---|---|---|
| `::ffff:0:0/96`, IPv4 **mapeada** ([RFC 4291](https://www.rfc-editor.org/rfc/rfc4291.html)) | nos últimos 32 bits | `[::ffff:127.0.0.1]` é `127.0.0.1` |
| `::/96`, IPv4 **compatível**, obsoleta (RFC 4291) | nos últimos 32 bits | `[::7f00:1]` é `127.0.0.1`; `::1` e `::` resultam em `0.0.0.1` e `0.0.0.0` |
| `64:ff9b::/96`, **NAT64** ([RFC 6052](https://www.rfc-editor.org/rfc/rfc6052.html)) | nos últimos 32 bits | `[64:ff9b::a9fe:a9fe]` é `169.254.169.254` |
| `2002::/16`, **6to4** ([RFC 3056](https://www.rfc-editor.org/rfc/rfc3056.html)) | nos bits 16 a 47 | `[2002:a9fe:a9fe::]` é `169.254.169.254` |

A ordem das verificações é essencial. 6to4 situa-se dentro de `2000::/3` e NAT64 fora, e ambos podem conter endereços públicos legítimos: `[64:ff9b::808:808]` e `[2002:808:808::1]` contêm `8.8.8.8`, um IP público que deve ser aceito; já os mesmos formatos contendo um IPv4 privado devem ser rejeitados. Nem a lista de permissões isolada nem o bloqueio integral do prefixo conseguem diferenciar os dois cenários. Extrair o IPv4 e avaliá-lo individualmente resolve a questão.

Não se trata de uma regra exaustiva para tudo o que não seja público, mas atende à listagem mínima proposta pelo [guia da OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), e a porção que mais se expande, a de IPv6, permanece blindada por padrão. O fato de a regra caber em uma tela e ser auditável em relação a registros públicos fortalece a defesa: uma regra incompreensível é uma regra não auditada. E o fato de nunca ser infalível justifica a presença da segunda camada, no nível da rede.

#### 1.10.2 As execuções de rejeição

Tente cadastrar o endereço de metadados da nuvem:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"metadatos","url":"http://169.254.169.254/latest/meta-data/"}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 70
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: 169.254.169.254:80: dirección privada o reservada
```

`400`, com o motivo: `169.254.169.254:80` é um endereço privado ou reservado. O `revisor` não efetuou o cadastro e jamais tentará se conectar a ele. Agora um nome com aparência inofensiva, apontando para o próprio `revisor`:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"yo-mismo","url":"http://localhost:18080/mantenimiento"}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 75
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: localhost resuelve a una dirección privada o reservada
```

O mesmo `400`, com um motivo mais reservado, de propósito. No primeiro caso, o endereço IP foi digitado por quem fez a requisição, de modo que repeti-lo não revela informação nova. No segundo, quem enviou conhecia apenas o **nome de domínio**; os endereços para os quais ele resolveu constituem dados internos da rede do `revisor`, e a mensagem não os divulga. No macOS, `localhost` resolve para dois endereços, `::1` e `127.0.0.1`, ambos de loopback; no Linux, conforme a configuração de `/etc/hosts`, pode resolver apenas para `127.0.0.1`. A resposta recebida pelo cliente é idêntica em ambos os sistemas, o que destaca outra vantagem de não enumerar IPs: o comportamento da API não varia em função do sistema operacional do servidor.

E o endereço de metadados de outro provedor de nuvem, situado no espaço compartilhado:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"metadatos-2","url":"http://100.100.100.200/latest/meta-data/"}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 70
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: 100.100.100.200:80: dirección privada o reservada
```

Por fim, as duas variantes de 6to4. `2002:a00:1::1` traz nos bits 16 a 47 os grupos `0a00` e `0001`, ou seja, `10.0.0.1`, uma rede privada; `2002:808:808::1` traz `0808` e `0808`, isto é, `8.8.8.8`, um endereço público:

```text
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"tunel-1","url":"http://[2002:a00:1::1]/"}'
destino prohibido: [2002:a00:1::1]:80: dirección privada o reservada
 → 400
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"tunel-2","url":"http://[2002:808:808::1]/"}'
{"id":4,"nombre":"tunel-2","url":"http://[2002:808:808::1]/","limite_ms":2000}
 → 201
```

O primeiro é rejeitado pelo conteúdo embutido, embora esteja em `2000::/3`; o segundo é aceito, embora uma regra que bloqueasse 6to4 por completo o tivesse rejeitado. O cadastro do segundo gerou o serviço 4, mas o `revisor` não estabeleceu nenhuma conexão: a primeira conexão ocorreria apenas na primeira revisão, momento em que o destino é inspecionado novamente.

Caso a pessoa que opera o `revisor` necessite dos endereços específicos para investigar uma rejeição, o local adequado para registrá-los é o log do servidor, nunca o corpo da resposta. O `revisor` do curso não os grava em lugar algum: os comentários de `destinos.ts` indicam onde deveriam constar, e o terminal exibe apenas o `POST /servicios` padrão, assegurando que a execução produza saídas idênticas em qualquer sistema operacional.

#### 1.10.3 A segunda verificação, antes de conectar

A primeira verificação já foi apresentada. A segunda localiza-se na primeira linha de `revisar`, em `cliente.ts`, e torna-se evidente quando a regra se altera entre o cadastro e a revisão. Os três serviços iniciais são inseridos diretamente no armazenamento, sem passar pela rota de cadastro; portanto, basta iniciar o `revisor` com uma lista de permissões que **não** inclua o laboratório. Interrompa o `revisor` e execute-o da seguinte forma (o `9` representa uma porta qualquer sem serviço ativo):

```text
$ REVISOR_DESTINOS=127.0.0.1:9 node servidor.ts
revisor en http://127.0.0.1:18080
```

E solicite uma revisão de `catalogo` utilizando o script de 1.6.4:

```text
$ node fig01_02.ts 1
202 Accepted; seguimiento en /revisiones/1
consulta 1: 200 pendiente, Retry-After: 1
consulta 2: 200 terminada
resultado: {"estado":"CAIDO","codigo":null,"ms":null,"detalle":"destino prohibido: 127.0.0.1:18081: dirección privada o reservada"}
```

O serviço estava cadastrado, a revisão foi aceita com `202`, o acompanhamento funcionou perfeitamente, mas o `revisor` **não se conectou**: antes de fazê-lo, checou novamente o destino e `127.0.0.1:18081` já não constava na lista de permissões. O resultado foi `CAIDO`, sem código de status nem milissegundos, pois não houve troca de mensagens, e o detalhe relata a causa. Em um ambiente de produção real, o que varia entre o cadastro e a revisão não é a lista de permissões, mas a resposta do DNS para um determinado domínio; o efeito prático é o mesmo, justificando a dupla validação. Interrompa o `revisor` e execute-o novamente sem a variável de ambiente.

#### 1.10.4 Uma URL com segredos

Há outra forma de o cadastro vazar algo, e ela não tem a ver com o lugar a que o `revisor` se conecta, mas com o que ele **repete**. Uma URL pode levar uma credencial dentro: `http://usuario:clave@servidor/estado` (o usuário e a senha vêm antes da arroba; a [RFC 3986, seção 3.2.1](https://www.rfc-editor.org/rfc/rfc3986#section-3.2.1), desaconselha esse formato justamente por isso) ou `http://servidor/estado?token=…` (um token na consulta). O `revisor` guarda a URL do jeito que chegou e a devolve em cada representação do serviço: no `201` do cadastro, na consulta e na lista. Se a aceitasse, a senha chegaria a qualquer um com permissão de leitura e a cada log ou cache que guarde essas respostas.

Há duas saídas. Uma é **redigir**: guardar a URL completa e devolvê-la sem usuário, sem senha, sem consulta e sem fragmento. A outra é **rejeitá-la no cadastro**. O `revisor` rejeita, pelo que esta lição ensina sobre representações: o que o `201` e o `200` devolvem é *o* serviço, e um cliente pode pegar essa representação e mandá-la de volta (a Lição 3 faz isso com `PUT`, que substitui o serviço inteiro). Se a representação omitisse uma parte, quem a reenviasse apagaria o token sem saber, e a representação mostraria um endereço diferente daquele que o `revisor` consulta. Rejeitar deixa a regra simples: o `revisor` só guarda o que pode mostrar por inteiro. O fragmento (`#…`) também é rejeitado, embora não seja segredo: ele nunca viaja até o servidor, então na URL de um serviço não serve para nada.

A regra está em `urlConSecretos`, em `servicios.ts`, e `darDeAlta` a consulta antes de verificar o destino. Por isso a rejeição é a mesma com a configuração de fábrica: embora `127.0.0.1:1` também seja um destino proibido, a URL é rejeitada primeiro pelo que carrega. A mensagem diz o que está errado e **não repete a URL**: repeti-la no erro seria devolver o segredo por outra porta.

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"fuga","url":"http://usuario:clave@127.0.0.1:1/estado?token=SECRETO#x"}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 66
Date: Thu, 22 Oct 2026 18:36:45 GMT
Connection: keep-alive
Keep-Alive: timeout=5

url no puede llevar usuario, clave, consulta (?) ni fragmento (#)
```

Ainda é um `400`, porque nesta lição tudo o que o `revisor` não aceita é `400`; a Lição 3 o transforma em `422`. Se um serviço exige uma credencial para informar seu estado, essa credencial não vai na URL: um revisor de verdade a guardaria à parte, como um segredo da sua configuração, e a mandaria em um cabeçalho ao consultar. Este `revisor` não faz isso, de propósito: só consulta serviços que respondem sem credencial. Os serviços iniciais não passam pelo cadastro, mas suas URLs são as do laboratório, sem usuário nem consulta. O teste `herramientas/url-sembrada.ts` semeia a URL `http://usuario:clave@127.0.0.1:1/estado?token=SECRETO#x` no `revisor` de cada lição e verifica que ela seja rejeitada e que nem as respostas nem o terminal repitam nada dela.

### 1.11 Verificar os tipos com `tsc` (opcional)

Assim como na Lição 0, o Node executa os programas sem checar os tipos, e o curso os valida com `tsc` em modo estrito. A partir desta lição é necessária uma opção adicional, `--allowImportingTsExtensions`, pois os arquivos do `revisor` importam-se mutuamente com a extensão `.ts`; junto com `--noEmit`, o TypeScript autoriza esse formato. Dentro de `~/curso-http/revisor/`:

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

Estando tudo correto, o `tsc` não emite nenhuma mensagem e encerra com código de saída 0, resultado obtido com os dez arquivos desta lição (os nove do `revisor` e `fig01_02.ts`).

## O erro a ser observado

**O cadastro que se perdeu sem erro.** Trata-se do cenário da cena inicial, que agora será reproduzido na prática. Envie o mesmo cadastro para ambas as rotas antigas, mas desta vez com a flag `-L`, para que o `curl` siga o redirecionamento assim como um programa faria. Sem `-X POST`: a opção `-d` já implica `POST`, comportamento padrão de qualquer cliente. Quem acompanhou a seção 1.10.3 já reiniciou o `revisor` sem a variável de ambiente, garantindo a presença dos três serviços iniciais. Primeiro, teste a rota migrada com `301`:

```text
$ curl -i -L http://127.0.0.1:18080/viejo/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 301 Moved Permanently
Location: /servicios
Content-Length: 0
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 275
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}
```

Duas respostas. A primeira é o `301`. A segunda é um `200` contendo a lista de serviços, e `avisos` não está nela. Inspecione o terminal do `revisor`, que é o único a relatar com precisão o ocorrido:

```text
POST /viejo/servicios
GET /servicios
```

O `curl` seguiu o `301`, conforme permitido pela RFC 9110 e documentado em seu manual: converteu o `POST` em `GET` e descartou o corpo. O `revisor` recebeu uma consulta legítima, respondeu a listagem com um `200` honesto e ninguém mentiu em nenhuma etapa. Para quem enviou o cadastro, o desfecho é um `200` e um serviço que simplesmente não existe. Agora, teste a rota migrada com `308`:

```text
$ curl -i -L http://127.0.0.1:18080/api/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 308 Permanent Redirect
Location: /servicios
Content-Length: 0
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

HTTP/1.1 201 Created
Location: /servicios/4
ETag: "4-1-aacab17b"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

O `308` e, em seguida, um `201` com `Location: /servicios/4`. No terminal do `revisor`:

```text
POST /api/servicios
POST /servicios
```

O `POST` chegou como `POST`, acompanhado de seu corpo, e o cadastro foi concluído. Para comprovar da forma mais simples, solicite a listagem:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 361
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":4,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}
```

`avisos` é o serviço 4. O serviço enviado ao `301` não consta em lugar nenhum.

**O que está errado e como corrigir.** Não há erro no `curl`, nem no `revisor`, nem na conduta de quem solicitou o cadastro: cada parte agiu estritamente dentro do que sua respectiva especificação autoriza. O equívoco reside **na escolha do código de status** para uma rota receptora de operações de escrita. A correção consiste em adotar `308` (ou `307`, em migrações temporárias) para qualquer rota legada passível de receber requisições diferentes de `GET` ou `HEAD`. Do lado do cliente, extrai-se uma lição igualmente valiosa: um programa que executa escritas não deve seguir redirecionamentos cegamente. Ao receber um `301` em resposta a um `POST`, o procedimento adequado é alertar o operador e atualizar o endpoint configurado, em vez de segui-lo de forma automática; a [Lição 7](07-quien-lee-el-error.md) consolida essa diretriz na matriz de decisões do cliente. O `curl` disponibiliza uma opção para manter o `POST` após um `301`, `--post301`, cujo teste é proposto no Exercício 2; essa flag existe precisamente porque a conversão para `GET` constitui o comportamento padrão. É uma opção do `curl` e de poucos outros clientes: o `fetch`, por exemplo, não tem uma equivalente e converte o `POST` em `GET` após um `301`, por especificação, de modo que o problema não se resolve do lado do cliente. A correção de verdade está no servidor: escolher o código que não deixa margem para dúvida.

**Uma armadilha ao reproduzir: `-X POST` com `-L`.** Se por hábito for digitado `-X POST` além de `-d`, o comportamento observado é diferente e pode confundir à primeira vista:

```text
$ curl -i -X POST -L http://127.0.0.1:18080/viejo/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 301 Moved Permanently
Location: /servicios
Content-Length: 0
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 21
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo no es JSON
```

A flag `-X` não instrui o `curl` a «usar `POST` na primeira requisição», mas sim a «forçar `POST` em **todas** as requisições», inclusive naquela gerada após o redirecionamento. O manual do `curl` alerta expressamente sobre isso: com `-L`, o método fixado por `-X` é replicado em cada etapa, acarretando efeitos colaterais imprevistos. O `curl` seguiu o `301` emitindo um `POST`, porém aplicou a outra parte da regra de redirecionamento e descartou o corpo. O `revisor` recebeu um `POST /servicios` vazio e respondeu `400 el cuerpo no es JSON`: desse modo, nem se reproduz o defeito original nem se conclui o cadastro. (Sem `-sS`, o `curl` pode inclusive emitir um aviso alertando que `-X` é redundante.) Para observar o comportamento real enfrentado por uma aplicação cliente, deixe que `-d` determine o método automaticamente.

**O método que não existe responde `404`.** O outro erro abordado nesta lição é o defeito intencional. Solicite um método não suportado pela rota:

```text
$ curl -i -X PATCH http://127.0.0.1:18080/servicios/1
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 19
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe esa ruta
```

A rota `/servicios/1` existe: ao receber `GET`, responde com sucesso. Com `PATCH`, o `revisor` devolve «no existe esa ruta», o que é incorreto. O código apropriado é `405 Method Not Allowed`, acompanhado do cabeçalho `Allow` relacionando os métodos aceitos — e a Lição 0 demonstrou que `Allow` é obrigatório em um `405`. Um cliente que receba esse `404` deduzirá erroneamente que errou o endereço, quando na verdade errou o método HTTP. Corrige-se esse comportamento fazendo com que `atender` diferencie ambos os casos, ajuste que constitui o primeiro passo da Lição 2.

## O que se costuma fazer de errado

**Responder `200` para qualquer operação bem-sucedida.** Um cadastro respondido com `200` deixa o cliente desprovido de `Location`; uma rotina em estágio inicial respondida com `200` induz o cliente a acreditar que já houve término; uma remoção com `200` e `{"ok": true}` força a leitura de um corpo que não acrescenta nada além do que o código de status já informa. Os quatro sucessos apresentados nesta lição existem justamente para orientar as ações do cliente sem demandar a leitura do corpo.

**Emitir um `201` sem cabeçalho `Location`.** A RFC autoriza sua omissão, caso em que o recurso criado coincide com a própria rota da requisição. Em um cadastro via `/servicios`, isso é falso: o serviço não fica localizado ali. O cliente é forçado a tentar deduzir o `id` vasculhando o corpo da resposta, sujeito a nomenclaturas que oscilam entre diferentes APIs.

**Emitir um `202` sem informar onde consultar o status.** Responder `202` sem fornecer um recurso de acompanhamento reduz as alternativas do cliente a dois caminhos ruins: presumir precipitadamente que a operação ocorreu ou reexecutá-la. Sem `Location` ou sem um corpo orientando a consulta, entrega-se apenas metade da resposta.

**Consultar o acompanhamento sem pausa.** O cliente que pergunta cinco mil vezes por segundo «já terminou?» transforma uma operação assíncrona em um ataque contra o próprio servidor. O `Retry-After` existe para isso; se ele faltar, o cliente impõe a si mesmo uma pausa mínima.

**Empregar `301` em endpoints receptores de escrita.** É a falha central desta lição: o `POST` é convertido em `GET` e o corpo é descartado sem registro de erro. Para rotas sujeitas a operações de escrita, deve-se usar `308`.

**Incluir corpo em respostas `204` ou `304`.** A RFC proíbe terminantemente a presença de corpo em ambos os códigos. O Node, por padrão, não transmite corpo nessas condições mesmo que seja escrito, mas outros servidores podem fazê-lo, induzindo o cliente a interpretar esse conteúdo residual como o início da resposta subsequente. A comunicação perde o sincronismo e respostas acabam entregues a requisições indevidas. Trata-se de uma infração à especificação que corrompe a integridade da conexão.

**Emitir um `304` sem cabeçalho `ETag`.** A RFC determina o envio, no `304`, dos mesmos cabeçalhos que acompanhariam um `200`, com destaque para a `ETag`. Sem ela, o cliente fica impossibilitado de validar se sua cópia local corresponde à versão ativa.

**Conectar-se à URL informada sem validar previamente o destino.** É a porta de entrada para vulnerabilidades de SSRF. Inspecionar unicamente a string da URL é insuficiente: impõe-se verificar os endereços IP resultantes da resolução DNS, antes de cada conexão, além de desabilitar o seguimento automático de redirecionamentos.

## Exercícios

Os quatro exercícios são autocorretivos: cada um conclui com uma execução prática confirmando se a previsão foi exata. Registre a previsão no [diário de bordo](bitacora.md) **antes** de executar qualquer comando. Reinicie o laboratório e o `revisor` **uma única vez**, antes do Exercício 1, e realize os quatro sequencialmente: os identificadores numéricos das soluções assumem essa ordem de execução.

### Exercício 1 — Quatro condições

Consulte `GET /servicios/1` com `curl -i` e anote a `ETag` obtida; na solução o valor obtido é `"1-1-0e296858"`, e localmente o sufixo será diferente. Preveja qual código o `revisor` responde para cada uma destas requisições:

1. `GET /servicios/1` com `If-None-Match: "1-1"`, a etiqueta escrita manualmente, sem o identificador de inicialização.
2. `GET /servicios/1` com `If-None-Match: W/` seguido da etiqueta obtida.
3. `GET /servicios/1` com `If-None-Match: "9-9-00000000", W/"8-8-00000000"`.
4. `GET /servicios/99` com `If-None-Match: *`.

Execute as quatro com `curl -s -o /dev/null -w '%{http_code}\n'` seguido do endereço e de `-H 'If-None-Match: …'`, e compare os resultados.

### Exercício 2 — Preservar o `POST` após um `301`

A seção «O erro a ser observado» menciona que o `curl` dispõe da opção `--post301`, que preserva o método `POST` ao seguir um `301`. Preveja qual será a resposta a esta requisição, quantas linhas de status serão exibidas e o que constará no log do terminal do `revisor`:

```bash
curl -i -L --post301 http://127.0.0.1:18080/viejo/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
```

Execute o comando e compare. Em seguida, responda: se o `curl` possui esse recurso, por que o texto enfatiza que a solução real é alterar o código de status no servidor e não exigir que cada cliente configure essa opção?

### Exercício 3 — Cinco destinos

Preveja quais destas URLs serão aceitas no cadastro do `revisor` e, para as recusadas, qual justificativa constará na mensagem de erro (todas foram escritas sob a forma de endereços, exceto a última, de modo que a mensagem deve citar o endereço):

1. `http://2130706433:18081/codigo/200`
2. `http://2130706433:18080/servicios`
3. `http://[::ffff:127.0.0.1]:18081/codigo/200`
4. `http://[64:ff9b::a9fe:a9fe]/`
5. `http://example.com/`

Para cada uma, envie um cadastro com um nome distinto (`d1` a `d5`) e inspecione apenas o corpo e o código de status com `curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"d1","url":"…"}'`. A quinta requisição requer acesso à internet na máquina para a resolução de nomes.

### Exercício 4 — O acompanhamento de uma revisão que não termina

Copie `fig01_02.ts` com o nome `ej4.ts` e reduza o teto de dez consultas para duas (`consulta <= 2`). Preveja o que será exibido por `node ej4.ts 2` e com qual código o processo será concluído (`echo $?`). Execute em seguida. O programa consegue distinguir entre «a revisão foi concluída» e «o limite de consultas foi atingido»? Caso negativo, o que falta implementar?

## Soluções

### Solução 1

```text
$ curl -i http://127.0.0.1:18080/servicios/1
HTTP/1.1 200 OK
ETag: "1-1-0e296858"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:17:42 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

```text
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: "1-1"'
200
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: W/"1-1-0e296858"'
304
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: "9-9-00000000", W/"8-8-00000000"'
200
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/99 -H 'If-None-Match: *'
404
```

`200`, `304`, `200` e `404`. A primeira não coincide porque uma etiqueta é opaca: `"1-1"` não é um fragmento de `"1-1-0e296858"`, é outra etiqueta distinta, e a comparação avalia o texto integral entre aspas. (Antes de uma reinicialização, era exatamente essa etiqueta que forneceria a um cliente uma cópia incorreta; daí a importância do identificador de inicialização.) A segunda coincide porque `If-None-Match` opera em modo de comparação fraca, onde o prefixo `W/` é desconsiderado. A terceira é uma lista válida na qual **nenhuma** etiqueta coincide com a ativa, fazendo o servidor responder com a representação completa. A quarta constitui a pegadinha: `*` representa «qualquer versão disponível», mas o serviço 99 não existe, de modo que não há versão a validar; o `revisor` busca o registro antes de checar a condição e responde `404`. Responder `304` nesse caso confirmaria indevidamente a existência de algo que não existe.

### Solução 2

```text
$ curl -i -L --post301 http://127.0.0.1:18080/viejo/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 301 Moved Permanently
Location: /servicios
Content-Length: 0
Date: Wed, 21 Oct 2026 13:17:42 GMT
Connection: keep-alive
Keep-Alive: timeout=5

HTTP/1.1 201 Created
Location: /servicios/4
ETag: "4-1-0e296858"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 13:17:42 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

Duas linhas de status: o `301` e um `201`. No terminal do `revisor`, constam `POST /viejo/servicios` e, em seguida, `POST /servicios`: com `--post301`, o `curl` repetiu o `POST` com seu respectivo corpo no novo endereço e o cadastro ocorreu com sucesso, recebendo o id 4 por se tratar do primeiro cadastro desta inicialização. Embora a opção exista no cliente, a solução definitiva deve ser implementada no código do servidor por uma questão prática: quem desenvolve o servidor controla o seu próprio código, não os clientes externos. É possível incluir `--post301` em scripts locais, mas não nas aplicações de terceiros que consomem a API, nem nas bibliotecas HTTP adotadas por elas, nem no `fetch` dos navegadores — que, de acordo com a especificação Fetch, converte compulsoriamente o `POST` em `GET` sem prover opção para desativar esse comportamento. O código `308` funciona de maneira uniforme e transparente para todos os clientes, sem exigir ajustes externos.

### Solução 3

```text
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"d1","url":"http://2130706433:18081/codigo/200"}'
{"id":5,"nombre":"d1","url":"http://2130706433:18081/codigo/200","limite_ms":2000}
 → 201
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"d2","url":"http://2130706433:18080/servicios"}'
destino prohibido: 127.0.0.1:18080: dirección privada o reservada
 → 400
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"d3","url":"http://[::ffff:127.0.0.1]:18081/codigo/200"}'
destino prohibido: [::ffff:7f00:1]:18081: dirección privada o reservada
 → 400
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"d4","url":"http://[64:ff9b::a9fe:a9fe]/"}'
destino prohibido: [64:ff9b::a9fe:a9fe]:80: dirección privada o reservada
 → 400
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"d5","url":"http://example.com/"}'
{"id":6,"nombre":"d5","url":"http://example.com/","limite_ms":2000}
 → 201
```

Duas são aceitas e três são rejeitadas, sendo a primeira a pegadinha. `http://2130706433:18081/` **é aceita**: o analisador de URLs converte `2130706433` em `127.0.0.1`, e `127.0.0.1:18081` corresponde exatamente à exceção concedida ao laboratório. A proteção não se deixou iludir pela notação incomum; pelo contrário, identificou o destino real e constatou que ele estava na lista permitida. Na porta 18080 há rejeição, e a mensagem indica `127.0.0.1:18080`, e não `2130706433`: o `revisor` avalia o endereço normalizado. A terceira também é loopback, expressa como IPv4 mapeada em IPv6: o analisador a normaliza para `::ffff:7f00:1`, endereço ausente na lista de permissões (que compara literais exatos), e `destinos.ts` extrai o `127.0.0.1` interno reconhecendo-o como loopback. A quarta oculta o IPv4 `169.254.169.254` sob o prefixo NAT64: em uma rede com NAT64 ativo conduziria ao serviço de metadados, sendo rejeitada em função do IP embutido. A quinta resolve para endereços IP públicos e é aceita (caso a máquina não possua conexão externa com a internet, haverá rejeição com mensagem indicando falha na resolução, comportamento igualmente correto: o que não se resolve não se pode verificar). Nenhum cadastro realizou conexão de rede: aceitar o destino apenas registra o serviço; a primeira conexão efetiva só ocorre na primeira revisão, momento em que nova checagem é aplicada.

### Solução 4

```text
$ node ej4.ts 2; echo $?
202 Accepted; seguimiento en /revisiones/1
consulta 1: 200 pendiente, Retry-After: 1
consulta 2: 200 pendiente, Retry-After: 1
0
```

Com apenas duas consultas, o programa nunca encontrou o estado `terminada`, imprimiu as duas linhas com `pendiente`, saiu do laço silenciosamente e finalizou com código 0, exatamente como se tudo tivesse corrido bem. (A segunda consulta ocorre um segundo após a primeira, tempo idêntico ao intervalo de espera da revisão na fila: trata-se de uma condição de corrida (race condition) decidida por milissegundos. Se na execução local a segunda consulta já encontrou o estado concluído, a revisão venceu a disputa; restrinja o teto a uma única consulta para evidenciar o mesmo comportamento.) Esse é o defeito explorado pelo exercício: o programa é incapaz de diferenciar «concluído com sucesso» de «desisti de consultar». Falta uma instrução após o laço que, constatando a ausência do estado `terminada`, emita um alerta e encerre com código diferente de zero — por exemplo, `console.log("la revisión no terminó a tiempo"); process.exit(1);` —, exigindo registrar em variável se houve ou não conclusão. Aplica-se aqui o mesmo princípio da Lição 0, agora do lado do cliente: o código de saída do processo também é um contrato, e um `0` desprovido de sucesso induz a erro o script chamador, da mesma forma que um `200` mascarando um erro interno.

## Critérios de sucesso

- [ ] Com o laboratório e o `revisor` em execução, `curl -i http://127.0.0.1:18080/servicios` retorna `200` com os três serviços iniciais.
- [ ] O cadastro de 1.5.2 retorna `201` com `Location: /servicios/4` e uma `ETag` no formato `"4-1-` seguida de oito dígitos hexadecimais, sendo possível explicar o que cada cabeçalho e cada parte da etiqueta identifica.
- [ ] `-d 'null'` retorna `400` com «el cuerpo no es un objeto JSON», e a requisição subsequente responde com `200`.
- [ ] Solicitar uma revisão retorna `202` com `Location: /revisiones/1`; consultá-la em seguida retorna `200` com `"pendiente"` e `Retry-After: 1`, e dois segundos após, `"terminada"`. É possível explicar por que o primeiro código é `202` e o segundo é `200`.
- [ ] `node fig01_02.ts 1` acompanha a revisão até o status `ARRIBA` respeitando `Retry-After`, em duas ou três consultas.
- [ ] Remover o serviço 4 retorna `204` sem `Content-Type` nem `Content-Length`; consultá-lo depois retorna `404`, sendo possível explicar por que o `DELETE` permanece idempotente.
- [ ] `GET /servicios/1` com `If-None-Match` e a etiqueta fornecida pelo `revisor` retorna `304` com `ETag` e sem corpo; com `W/` à frente, em uma lista ou com `*`, o retorno também é `304`. Sabe-se quais cabeçalhos devem acompanhar um `304` segundo a RFC 9110.
- [ ] Após reiniciar o `revisor`, a etiqueta anterior retorna `200` acompanhado de uma nova etiqueta, sendo possível explicar por que isso previne um `304` falso.
- [ ] Com `curl -L`, o cadastro enviado a `/viejo/servicios` resulta em um `200` com a listagem e o terminal do `revisor` registra `GET /servicios`; o cadastro enviado a `/api/servicios` resulta em um `201` e o terminal registra `POST /servicios`.
- [ ] Os cadastros do quadro de segurança retornam `400` com «destino prohibido», sendo possível explicar em que situação `localhost:18081` é rejeitado e em que situação é aceito, mesmo que `127.0.0.1:18081` seja sempre aceito.
- [ ] É possível explicar o que é DNS rebinding, por que validar antes de cada conexão não elimina o risco por completo e como atua a proteção integral introduzida na Lição 8.
- [ ] Ao terminar, nenhum processo permanece escutando nas portas: `curl -i http://127.0.0.1:18080/` e `curl -i http://127.0.0.1:18081/` retornam erro 7.

## Resumo

Responda sem consultar a lição:

1. Quais três perguntas diferenciam o `200`, o `201`, o `202` e o `204`?
2. O que `Location` identifica em um `201`? E em um `202`? E em um `301`?
3. Por que um `202` deveria apontar para um recurso de acompanhamento, segundo a RFC 9110? Qual código de status esse recurso retorna enquanto a operação estiver pendente?
4. Por que a segunda execução de `DELETE` para o mesmo serviço retorna `404` e o método ainda assim é considerado idempotente?
5. O que é uma `ETag`, para que serve `If-None-Match` e por que um `304` não contém corpo? Por que a etiqueta do `revisor` muda a cada inicialização?
6. O que acontece com um `POST` que recebe um `301` quando seguido por `curl -L`? E com um que recebe um `308`? Por que essa diferença existe?
7. O que é SSRF, por que o `revisor` traz isso de nascença e por que verifica o destino duas vezes?
8. O que é DNS rebinding, como o `revisor` desta lição se defende contra ele e como o problema é definitivamente solucionado?

## Fontes

Todas as referências foram consultadas em 21 de outubro de 2026.

1. [RFC 9110, *HTTP Semantics*](https://www.rfc-editor.org/rfc/rfc9110.html), seções 15.3.1, 15.3.2, 15.3.3 e 15.3.5: `200`, `201`, `202` e `204`; o conteúdo de `200` conforme o método, `Location` e os validadores do `201`, o `202` «intencionalmente vago» com seu monitor de status, e o `204` que não pode conter corpo.
2. [RFC 9110, seção 15.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4), e seções 15.4.2, 15.4.5 e 15.4.9: o histórico da conversão de `POST` para `GET`, o `301`, o `304` com os cabeçalhos que deve gerar, e o `308`.
3. [RFC 9110, seções 9.2.2, 9.3.3 e 9.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2): métodos idempotentes, o `201` com `Location` para operações de criação via `POST`, e as três respostas possíveis para um `DELETE` bem-sucedido.
4. [RFC 9110, seções 8.6, 8.8.1, 8.8.3, 8.8.3.1 e 8.8.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3): `Content-Length` em `204` e `304`; a proibição de reutilização de uma etiqueta forte para outra representação; a `ETag` como texto opaco delimitado por aspas e seu exemplo com número de revisão; comparações forte e fraca.
5. [RFC 9110, seções 10.2.2, 10.2.3 e 13.1.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2): `Location` como referência relativa, `Retry-After`, e a avaliação de `If-None-Match` (`*` ou lista, comparação fraca, `304` para `GET` e `HEAD`, `412` para os demais).
6. [RFC 7538, *The Hypertext Transfer Protocol Status Code 308 (Permanent Redirect)*](https://www.rfc-editor.org/rfc/rfc7538.html), abril de 2015, padronizando o `308` da [RFC 7238](https://www.rfc-editor.org/rfc/rfc7238.html) (junho de 2014, experimental), e a advertência quanto a clientes legados que não o reconhecem (seção 4).
7. [Padrão Fetch, WHATWG](https://fetch.spec.whatwg.org/#http-redirect-fetch), algoritmo *HTTP-redirect fetch*: após um `301` ou `302` aplicado a um `POST`, o método passa a ser `GET` e o corpo é descartado.
8. [Manual do `curl`](https://curl.se/docs/manpage.html): a flag `-L` e a conversão de `POST` para `GET` após `301`, `302` e `303`; a flag `--post301`; `-d` e `-X`. Consulta efetuada também via `man curl` na versão 8.7.1.
9. [OWASP API Security Top 10, edição 2023: API7:2023 Server Side Request Forgery](https://api-security.owasp.org/editions/2023/en/0xa7-server-side-request-forgery/): a definição de SSRF, os motivos pelos quais *webhooks* e prévias de links ampliam a exposição, e as recomendações para desativar redirecionamentos e usar listas de permissões.
10. [OWASP, *Server-Side Request Forgery Prevention Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): serviços de metadados na nuvem como alvo frequente, a lista mínima de faixas reservadas (incluindo multicast), formatos alternativos de representação de IPv4, DNS rebinding e a técnica de conexão ao endereço IP previamente validado.
11. [AWS, *Use the Instance Metadata Service to access instance metadata*](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html) e [Alibaba Cloud, *View instance metadata*](https://www.alibabacloud.com/help/en/ecs/user-guide/view-instance-metadata): os endereços `169.254.169.254` (e `[fd00:ec2::254]`) e `100.100.100.200` adotados em seus serviços de metadados.
12. [Padrão URL, WHATWG](https://url.spec.whatwg.org/#concept-ipv4-parser), o analisador IPv4: aceita endereços expressos como um único número inteiro, em notação hexadecimal ou octal, convertendo-os para o formato padrão.
13. Os blocos de `destinos.ts`: registros de endereços de uso especial da IANA, [IPv4](https://www.iana.org/assignments/iana-ipv4-special-registry/) e [IPv6](https://www.iana.org/assignments/iana-ipv6-special-registry/), e o [espaço de endereços IPv6](https://www.iana.org/assignments/ipv6-address-space/) (`2000::/3`, *Global Unicast*); [RFC 1918](https://www.rfc-editor.org/rfc/rfc1918.html) (redes privadas), [RFC 3927](https://www.rfc-editor.org/rfc/rfc3927.html) (link-local `169.254/16`), [RFC 4291](https://www.rfc-editor.org/rfc/rfc4291.html) (link-local, multicast e IPv4 mapeada em IPv6), [RFC 4193](https://www.rfc-editor.org/rfc/rfc4193.html) (endereços locais únicos), [RFC 5771](https://www.rfc-editor.org/rfc/rfc5771.html) (multicast IPv4), [RFC 6052](https://www.rfc-editor.org/rfc/rfc6052.html) (o prefixo de NAT64), [RFC 3056](https://www.rfc-editor.org/rfc/rfc3056.html) (6to4, fevereiro de 2001), [RFC 6598](https://www.rfc-editor.org/rfc/rfc6598.html) (espaço compartilhado `100.64/10`) e [RFC 6890](https://www.rfc-editor.org/rfc/rfc6890.html) (registro de endereços de uso especial).
14. [Node.js 24: DNS](https://nodejs.org/docs/latest-v24.x/api/dns.html), [Node.js 24: Net](https://nodejs.org/docs/latest-v24.x/api/net.html) e [Node.js 24: HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html): `dns.lookup` com `all: true` e a resolução do sistema operacional, `net.BlockList` com tratamento de IPv4 em IPv6, e a opção `lookup` em `http.request`.

### Termos desta lição

| | |
|---|---|
| **DNS rebinding** | alterar a resolução DNS de um nome de domínio entre a validação e a conexão, fazendo com que o servidor se conecte a um endereço IP não verificado |
| **comparação fraca** | a comparação utilizada por `If-None-Match`: duas etiquetas coincidem se o texto entre aspas for idêntico, independentemente da presença do prefixo `W/` |
| **`ETag`** (*entity tag*) | etiqueta opaca delimitada por aspas que identifica a versão específica de um recurso |
| **identificador de inicialização** | os oito dígitos hexadecimais aleatórios sorteados pelo `revisor` ao iniciar e anexados a cada etiqueta, para que as etiquetas não se repitam após uma reinicialização |
| **idempotente** | um método cujo efeito colateral no servidor é idêntico quer seja executado uma única vez ou repetidas vezes |
| **lista de permissões / lista de bloqueios** | uma regra que especifica o que é permitido e rejeita o restante (*allowlist*), ou que especifica o que é proibido e autoriza o restante (*denylist*) |
| **loopback** | os endereços atribuídos à própria máquina local: `127.0.0.0/8` e `::1` |
| **metadados da nuvem** | o serviço em `169.254.169.254` onde provedores de nuvem disponibilizam dados internos da máquina virtual, frequentemente incluindo credenciais de acesso |
| **requisição condicional** | uma requisição cuja execução fica condicionada à validação prévia da versão do recurso, como no caso do cabeçalho `If-None-Match` |
| **recurso de acompanhamento** | o endpoint indicado por uma resposta `202`, no qual o cliente consulta o andamento da operação assíncrona |
| **referência relativa** | um caminho sem especificação de protocolo, servidor ou porta, como `/servicios/4`, resolvido a partir da URL da requisição de origem |
| **SSRF** | induzir um servidor a emitir uma requisição para um destino definido por terceiros, explorando a posição de rede do servidor |

---

**Próxima:** [Lição 2 — O cliente errou (I): 400, 401, 403, 404, 405 e 415](02-errores-del-cliente-peticion.md)

# Lição 3 — O cliente errou (II): 409, 410, 412, 422 e 428

São 17h40 de uma sexta-feira e Ana, da equipe de pagamentos, acaba de mudar o serviço de cobranças para o novo endereço. O antigo é desligado às 18h. Ela abre a ficha do serviço no `revisor`, troca a URL, salva e recebe `200 OK`. Vai embora tranquila. O que ela não sabe é que Beto, da mesma equipe, abriu essa mesma ficha às 17h30 para aumentar o tempo limite de 2 para 3 segundos, saiu para um café e voltou às 17h45. Beto muda o limite, salva e também recebe `200 OK`. Só que o que Beto salvou foi **a sua cópia completa**, a das 17h30, que ainda trazia o endereço antigo. Às 18h o endereço antigo é desligado, o `revisor` o consulta, recebe um erro de conexão e marca o serviço de cobranças como `CAIDO` a noite inteira. O serviço novo funciona perfeitamente; ninguém o está vigiando. E nenhuma das duas pessoas recebeu um erro: as duas viram um `200`.

Isso se chama **atualização perdida** (*lost update*), e esta lição a evita com uma tag e um cabeçalho. De quebra, dá nome às outras quatro formas em que uma requisição bem formada ainda assim não pode ser cumprida.

**Tempo:** 2 × 45 min (o corte está entre as seções 3.4 e 3.5)

**O que se constrói:** a alteração de um serviço (`PUT /servicios/{id}`) que não sobrescreve a alteração de outra pessoa; a validação que separa o que não pode ser lido do que não pode ser cumprido; a memória dos serviços retirados; e a versão anterior da API, que avisa que vai sair antes de sair

**O que se aprende:** a distinguir um **conflito de estado** (`409`), uma **regra de negócio** que os dados não cumprem (`422`) e uma **pré-condição** que falhou (`412`); o que é a atualização perdida e como `ETag` com `If-Match` a evita, inclusive quando duas requisições chegam ao mesmo tempo; `412` versus `428`; `410` versus `404`; a política escrita do curso para `400` versus `422`; e como se anuncia a aposentadoria de uma versão da API com `Deprecation` e `Sunset` antes de chegar o `410`

**De onde se parte.** Da [Lição 2](02-errores-del-cliente-peticion.md), com um `revisor` que tem ponto de entrada: sabe quem fala com ele, o que cada credencial pode fazer, que rota e que método existem, e em que formato aceita o corpo. Esse `revisor` ainda não permite **alterar** um serviço: apenas cadastrá-lo, consultá-lo, retirá-lo e verificá-lo. Responde `400` a tudo o que não lhe serve no corpo, seja porque não pode ser lido, seja porque é lido e não faz sentido. E, quando um serviço é retirado, seu identificador fica em `404`, como se nunca tivesse existido.

**O que esta lição não faz.** Não ensina `PATCH`: o `revisor` altera um serviço inteiro com `PUT`, e um `PATCH` continua respondendo `405`. Não ensina o cabeçalho `If-Unmodified-Since`, o irmão de `If-Match` que compara datas em vez de tags; o curso usa apenas tags, porque as datas HTTP têm resolução de um segundo e duas alterações no mesmo segundo seriam indistinguíveis. E os corpos de erro continuam sendo uma linha de texto; a [Lição 5](05-problem-details.md) os converte em `application/problem+json`, e ali a lista de falhas do `422` vira um array que um programa pode percorrer.

**Sobre as execuções.** O Linux Mint 22 é o sistema de referência do curso. As saídas desta lição foram obtidas em 21 de outubro de 2026 no macOS com Node 24.14.1 e curl 8.7.1, e nenhuma depende de algo próprio do macOS. Na execução de quem acompanha vão mudar a data do cabeçalho `Date` e **os oito dígitos finais de cada `ETag`** (`"1-1-c6e922ee"` na execução principal da lição): o `revisor` os sorteia toda vez que inicia, então os de cada pessoa serão outros e mudarão a cada reinicialização. Quando um comando precisar de uma tag, copie a que saiu na resposta anterior, ou guarde-a em uma variável como a lição faz com `ETAG=$(…)`. O `revisor` guarda tudo em memória, então cada resposta depende do que as requisições anteriores fizeram. Por isso as execuções da lição estão agrupadas em **séries**, e o texto marca onde começa cada uma: a série A é a principal, com o `revisor` de `fig03_01/` recém-iniciado, e vai da seção 3.2.3 até o fim da 3.8 sem reiniciar; as outras (o programa dos dois editores, cada versão quebrada e os exercícios) são curtas e começam, cada uma, com um `revisor` recém-iniciado. Para obter o mesmo que a lição, inicie o `revisor` de novo onde começa cada série, e não o reinicie no meio de uma. Os programas estão em [`programas/03-errores-del-cliente-estado/`](../programas/03-errores-del-cliente-estado), no repositório do curso: o `revisor` em `fig03_01/`, os dois editores em `fig03_02.ts`, o leitor de avisos em `fig03_03.ts`, as versões quebradas de «O erro a ser observado» em `defectos/`, e cada execução em seu arquivo `.salida.txt`. Todos passam no `tsc` em modo estrito com o mesmo comando da seção 1.11 da Lição 1.

## Ao terminar, será possível

- Classificar uma requisição que falha como conflito de estado, regra de negócio ou pré-condição, e responder `409`, `422` ou `412` conforme a pergunta que a decide.
- Provocar uma atualização perdida com dois editores e demonstrar com uma execução que `If-Match` a converte em um `412`.
- Provocar a mesma perda com duas requisições simultâneas que enviam `If-Match`, e explicar por que a versão é comparada de novo no mesmo passo em que se escreve, como um `UPDATE … WHERE version = N`.
- Explicar por que `If-Match` é comparado em modo forte, o que acontece com uma tag `W/`, com uma lista e com `*`, e citar a seção do RFC 9110 que o exige.
- Distinguir `412` de `428` e dizer o que o cliente precisa fazer em cada caso.
- Responder `410` a um recurso que foi retirado de propósito e `404` a um que nunca existiu, sem revelar a outra equipe o que existiu.
- Anunciar a aposentadoria de uma versão da API com `Deprecation`, `Sunset` e `Link`, e comprovar com um programa que a data de `Sunset` não é anterior à de `Deprecation`.

## O porquê antes do como

Na Lição 2, todas as falhas podiam ser descobertas olhando **a requisição sozinha**: a rota, o método, a credencial, o tipo do corpo. Se estavam erradas, estavam erradas em qualquer momento e contra qualquer servidor. As falhas desta lição são diferentes: a requisição está bem escrita, é lida por completo e, ainda assim, não pode ser cumprida. Para saber isso, o servidor precisa olhar **algo além da requisição**: o estado atual do recurso, as regras do negócio, ou o que o cliente acreditava quando a escreveu.

Por isso os cinco códigos desta lição respondem a perguntas que na Lição 2 não existiam:

| Pergunta | Se a resposta é «não»… | Código | O que quem pediu precisa fazer |
|---|---|---|---|
| Os dados fazem sentido, cada um por si? | foram lidos, mas algum valor é impossível | `422` | corrigir esses valores |
| Cabem com o que já existe? | colidem com o estado atual do servidor (por exemplo, outro serviço já usa esse nome) | `409` | resolver a colisão e enviar de novo |
| O recurso está como o cliente acreditava? | mudou desde que ele o leu | `412` | reler, refazer a sua alteração, enviar de novo |
| O cliente disse que versão acreditava ter? | não disse, e o servidor exige | `428` | ler e enviar a tag |
| O recurso continua ali? | foi retirado de propósito e não vai voltar | `410` | parar de pedi-lo e apagar o link |

Cada linha é, outra vez, uma ação diferente para quem recebe o erro, e quase sempre esse alguém é um programa. Um `422` diz «os dados estão errados; corrija-os». Um `409` diz «os dados estão certos, mas colidem com algo que já existe». Um `412` diz «os dados podem estar certos, mas foram escritos pensando em uma versão que já não existe». Se o `revisor` respondesse os três com `400`, o programa de Beto não teria como saber que o que devia fazer era **reler**, que é justamente a única coisa que teria salvado a alteração de Ana.

A lição tem quatro partes:

1. **Três perguntas que se confundem** (3.1): conflito de estado, regra de negócio e pré-condição.
2. **A atualização perdida** (3.2 a 3.4): provocá-la no vermelho, evitá-la no verde com `ETag` e `If-Match` (`412`), fechar a condição de corrida (*race condition*) de duas requisições simultâneas comparando no mesmo passo em que se escreve, e exigir a condição (`428`).
3. **Conflito, regra e recurso que se foi** (3.5 a 3.7): `409`, a política de `400` versus `422`, e `410` versus `404`.
4. **Versões da API e o `revisor` completo** (3.8 e 3.9): `Deprecation`, `Sunset` e o `410` anunciado; os arquivos e a execução.

## Os conceitos

### 3.1 Conflito de estado, regra de negócio e pré-condição

#### 3.1.1 Três falhas que parecem a mesma

Imagine três requisições da equipe `a` que o `revisor` rejeita. As três são JSON válido, as três chegam com uma credencial de escrita e as três vão a uma rota que existe:

- Um cadastro com `{"nombre":"","url":"ftp://archivos","limite_ms":5}`.
- Um cadastro com `{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}`, quando a equipe `a` já tem um serviço chamado `pagos`.
- Uma alteração do serviço 1 feita a partir de uma cópia lida há dez minutos, quando outra pessoa já o alterou.

Se alguém que está começando for perguntado o que elas têm em comum, dirá «são erros de validação» e responderá `400` às três. Mas veja o que teria de fazer quem as enviou para que a próxima funcione:

- Na primeira, **corrigir os dados**. Não importa quantas vezes a repita, nem o que aconteça no servidor enquanto isso: um nome vazio nunca será válido. A falha está **dentro** da requisição.
- Na segunda, **os dados estão certos**. O nome `pagos` é perfeitamente válido; o problema é que já existe outro. Se amanhã alguém retirar o serviço `pagos` da equipe a, esta mesma requisição, sem mudar um byte, vai funcionar. A falha está na **colisão** entre a requisição e o estado atual do servidor.
- Na terceira, pode ser que os dados estejam certos **e** que não colidam com nada. O problema é outro: quem a enviou escreveu sua alteração sobre uma versão do serviço que já não existe. Se o servidor a aceitasse, apagaria a alteração de outra pessoa sem que ninguém percebesse. A falha está em uma **suposição** do cliente que deixou de ser verdadeira.

São três falhas distintas, e o HTTP tem um código para cada uma:

| Falha | Onde está o problema | Código | Seção |
|---|---|---|---|
| **Regra de negócio**: os dados não podem ser cumpridos | dentro da requisição | `422 Unprocessable Content` | RFC 9110, 15.5.21 |
| **Conflito de estado**: os dados colidem com o que já existe | entre a requisição e o estado atual | `409 Conflict` | RFC 9110, 15.5.10 |
| **Pré-condição**: o cliente supunha um estado que já não é | no que o cliente acreditava | `412 Precondition Failed` | RFC 9110, 15.5.13 |

#### 3.1.2 O que a especificação diz de cada um

As definições do [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) são curtas, e vale a pena lê-las com cuidado, porque cada uma traz a pergunta que a decide.

O **`422`** ([seção 15.5.21](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.21)) diz que o servidor **entende o tipo de conteúdo** (por isso não é `415`), que **a sintaxe está correta** (por isso não é `400`), mas que não pôde processar as instruções que o conteúdo traz. O exemplo da especificação é um XML bem formado com instruções que não fazem sentido. A pergunta que o decide é: **consegui ler, mas o que ele diz é impossível?**

O **`409`** ([seção 15.5.10](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.10)) diz que a requisição não pôde ser concluída por causa de um **conflito com o estado atual** do recurso, e que é usado quando o usuário **poderia resolver o conflito e enviar de novo** a requisição. Acrescenta um **deveria**: o servidor deveria responder com informação suficiente para que o usuário reconheça de onde vem o conflito. A pergunta que o decide é: **isso seria válido se o servidor estivesse em outro estado?**

O **`412`** ([seção 15.5.13](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.13)) diz que **uma ou mais condições que vinham nos cabeçalhos** da requisição resultaram falsas ao serem avaliadas no servidor, e que existe para que o cliente possa impedir que o método seja aplicado se o recurso estiver em um estado inesperado. A pergunta que o decide é: **o cliente colocou uma condição, e ela não foi cumprida?**

Repare na última frase: o `412` só existe se **o cliente** colocou uma condição. O servidor não inventa pré-condições; ele as avalia. Essa é a diferença mais fina da lição, e volta na seção 3.5.

#### 3.1.3 Em que ordem se perguntam

O ponto de entrada da Lição 2 tinha sete perguntas: rota, método, credencial, permissão, existência, formato e leitura. Esta lição acrescenta perguntas entre elas e **depois** delas, e a ordem também importa. A partir da existência, uma alteração (`PUT`) pergunta isto:

1. O recurso existe, para quem pede? Se foi retirado e era dele, `410`; se não, `404`.
2. (Como na Lição 2) O corpo diz ser JSON? Se o cabeçalho `Content-Type` diz outra coisa, `415`. Isso se sabe sem ler o corpo.
3. Só em uma alteração: a condição foi enviada? Se não, `428`. Ela é cumprida? Se não, `412`.
4. (Como na Lição 2) O corpo pode ser lido? Se não, `400`. E se passa de 16 KiB, o limite que o `revisor` aceita, `413` (seção 3.6.1).
5. Os dados podem ser cumpridos? Se não, `422`.
6. Colidem com o estado do servidor? Se colidem, `409`.
7. Só em uma alteração, ao escrever: a versão continua sendo a que coincidiu no passo 3? Se outra requisição a alterou nesse meio-tempo, `412`; se outra a retirou, `410`. Esse passo parece repetido, e não é: a seção 3.3.4 mostra o que acontece sem ele.

Por que o formato vem antes da condição, e a condição antes de ler o corpo? Porque a especificação assim o pede. A [seção 13.2.1 do RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.1) diz que um servidor **deve** avaliar as pré-condições depois de suas verificações normais da requisição e **logo antes de processar o conteúdo** ou de executar o método. E acrescenta a outra metade da regra: o servidor **deve ignorar** as pré-condições se, sem elas e **antes de processar o conteúdo**, a resposta teria sido algo diferente de um `2xx` ou de um `412`. Dito de outro modo: os erros detectados antes de se trabalhar a sério vencem a condição. Uma rota que não existe, uma credencial ausente e um recurso retirado são desses. Também é um `Content-Type` que não se aceita: o `415` sai de um cabeçalho, sem ler um único byte do corpo (a [seção 15.5.16](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.16) diz que o `415` pode se dever ao `Content-Type` que a requisição declara). Por isso um `PUT` com `text/plain` recebe `415` mesmo que sua tag esteja velha, e um `PUT` com `If-Match: *` a um serviço retirado recebe `410` e não `412`, como se verá em 3.7. O que de fato espera pela condição é **ler** o corpo: o `400` e o `422` só se sabem depois de processá-lo.

O `428` não é uma pré-condição que se avalie; é a falta de uma. Mesmo assim, o `revisor` o pergunta no mesmo lugar que o `412`, depois do formato: assim as duas respostas que mandam o cliente ler a tag saem do mesmo passo, e um cliente que envia o formato errado e nenhuma condição fica sabendo primeiro do que se sabe sem ler nada.

E há uma razão prática para que a condição vá antes da leitura: se a tag é velha, tudo o que o corpo disser está escrito sobre uma versão que já não existe. Não vale a pena revisá-lo campo a campo e dizer ao cliente «o nome está errado» quando o que ele precisa fazer primeiro é reler. Os exercícios comprovam isso com execuções: o 1, com um `text/plain` sem condição e outro com uma tag velha; o 3, com uma requisição que traz uma tag velha e dados impossíveis ao mesmo tempo.

### 3.2 A atualização perdida

#### 3.2.1 Dois editores e um `200` para cada um

A cena do começo não precisa de má sorte nem de um erro de programação; bastam duas pessoas e um `PUT` que não pergunta nada. O problema tem nome na especificação: o RFC 9110, na [seção 13.1.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1), o chama de *lost update* e diz que `If-Match` existe sobretudo para evitá-lo, quando vários clientes atuam em paralelo sobre o mesmo recurso.

Ocorre, em sua forma mais comum, com uma sequência de quatro passos (com três editores, ou com um processo automático no meio, é a mesma ideia, com mais atores):

1. Ana lê o serviço. Tem uma cópia.
2. Beto lê o serviço. Tem uma cópia idêntica.
3. Ana muda o endereço na sua cópia e a salva. O servidor fica com o endereço novo.
4. Beto muda o limite na **sua** cópia, que ainda tem o endereço antigo, e a salva. O servidor fica com o limite novo **e o endereço antigo**.

O passo 4 é o que dói. O `PUT` substitui o recurso inteiro pelo que o corpo traz: a [seção 9.3.4 do RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.4) diz que ele pede que o estado do recurso seja **criado ou substituído** pelo que vem na requisição. Beto não quis mexer no endereço; simplesmente enviou o que tinha. Para o servidor, não há como distinguir «não mexi» de «quero assim».

O programa `fig03_02.ts` reproduz os quatro passos contra o `revisor`. Ana coloca o endereço `…/codigo/204`; Beto, o limite de 3000 ms. No final o serviço é lido e o programa diz se a alteração de Ana sobreviveu:

```ts
// fig03_02.ts
// Dos editores: Ana y Beto leen el mismo servicio, cada uno cambia algo distinto y lo guarda.
// Ana cambia la dirección; Beto, que leyó antes de que Ana guardara, cambia el límite.
// Al final se lee el servicio y se dice si el cambio de Ana sobrevivió.
// Uso: node fig03_02.ts
const BASE = "http://127.0.0.1:18080/servicios/1";
const AUTORIZACION = { Authorization: "Bearer escritura-a" };

type Copia = { etiqueta: string; datos: Record<string, unknown> };

async function leer(quien: string): Promise<Copia> {
  const respuesta = await fetch(BASE, { headers: AUTORIZACION });
  const datos = (await respuesta.json()) as Record<string, unknown>;
  const etiqueta = respuesta.headers.get("etag") ?? "";
  console.log(`${quien.padEnd(8)} lee:    ${respuesta.status} ${etiqueta} ${JSON.stringify(datos)}`);
  return { etiqueta, datos };
}

// Guarda la copia completa (PUT reemplaza el servicio entero), con la etiqueta que leyó.
async function guardar(quien: string, copia: Copia): Promise<number> {
  const { id: _id, ...cuerpo } = copia.datos;
  const respuesta = await fetch(BASE, {
    method: "PUT",
    headers: { ...AUTORIZACION, "Content-Type": "application/json", "If-Match": copia.etiqueta },
    body: JSON.stringify(cuerpo),
  });
  const texto = (await respuesta.text()).trim();
  const nueva = respuesta.headers.get("etag");
  console.log(`${quien.padEnd(8)} guarda: ${respuesta.status} ${nueva === null ? "" : `${nueva} `}${texto}`);
  return respuesta.status;
}

const DIRECCION_NUEVA = "http://127.0.0.1:18081/codigo/204";

const ana = await leer("Ana");
const beto = await leer("Beto");
ana.datos.url = DIRECCION_NUEVA;
beto.datos.limite_ms = 3000;
await guardar("Ana", ana);
if ((await guardar("Beto", beto)) === 412) {
  // El 412 le dice a Beto que su copia es vieja: vuelve a leer, repite SU cambio y guarda.
  const otraVez = await leer("Beto");
  otraVez.datos.limite_ms = 3000;
  await guardar("Beto", otraVez);
}

const final = await leer("Al final");
console.log(final.datos.url === DIRECCION_NUEVA ? "el cambio de Ana sigue ahí" : "SE PERDIÓ el cambio de Ana, y nadie recibió un error");
```

Se o servidor responde `412` a Beto, o programa faz o que um cliente bem escrito deve fazer: lê de novo, aplica **a sua** alteração (apenas o limite) sobre a cópia nova e salva outra vez. Mas isso só acontece se o servidor responder `412`. Primeiro, o vermelho.

#### 3.2.2 No vermelho: um `PUT` que não pergunta

Este é o `PUT` que quase todo mundo escreve na primeira vez: buscar o serviço, ler o corpo, validá-lo e salvá-lo. Funciona, passa em todos os testes de um único usuário e perde dados assim que há dois. Para ver isso, copie a pasta `fig03_01/` da seção 3.9 como `rota/` e apague de `cambiar`, em `rota/servicios.ts`, todo o bloco que vai de `const condicion = …` até o cálculo de `versionLeida`, e passe `null` a `cambiarServicio`. Fica assim (é um fragmento; a versão completa está em `defectos/sin-condicion/servicios.ts`):

```ts
export async function cambiar({ peticion, respuesta, parametros, credencial }: Contexto): Promise<void> {
  const servicio = encontrar(parametros[0], credencial, respuesta);
  if (servicio === undefined) return;
  // Primero el formato (415), después la condición (428 y 412), después la lectura (400).
  if (!esJson(peticion, respuesta)) return;
  const datos = await leerJson(peticion, respuesta);
  if (datos === undefined) return;
  // … validar, destino y nombre repetido, igual que antes
  const cambiado = cambiarServicio(servicio.id, null, validos);
```

**Série C:** inicie o laboratório e o `revisor` a partir de `rota/`. Primeiro, um `PUT` sem `If-Match`, que no `revisor` desta lição dá `428`:

```text
$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-2-dedb68a8"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:25 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}
```

`200`. Nada o detém. E agora os dois editores. Copie `fig03_02.ts` ao lado de `rota/` e execute-o:

```text
$ node fig03_02.ts
Ana      lee:    200 "1-2-dedb68a8" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}
Beto     lee:    200 "1-2-dedb68a8" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}
Ana      guarda: 200 "1-3-dedb68a8" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/204","limite_ms":1500}
Beto     guarda: 200 "1-4-dedb68a8" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}
Al final lee:    200 "1-4-dedb68a8" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}
SE PERDIÓ el cambio de Ana, y nadie recibió un error
```

Aí está a cena do começo, completa. Ana salvou o endereço novo (`…/codigo/204`) e recebeu `200`. Beto salvou sua cópia velha com o limite novo e **também** recebeu `200`, e ao fazê-lo devolveu o endereço a `…/codigo/200`. Repare que Beto **enviou** `If-Match`, com a tag `"1-2-…"` que leu; o servidor simplesmente não a olhou. Um cabeçalho condicional que o servidor ignora não protege nada, e o cliente não tem como saber: a especificação permite que um intermediário ignore `If-Match`, mas o servidor de origem que o recebe **deve** avaliá-lo antes de executar o método (seção 13.1.1).

O que está errado não se vê em nenhum cabeçalho: é o próprio `200`. Um `200` disse a Beto «a alteração foi aplicada sobre o que foi lido», e era mentira: foi aplicada sobre algo que Beto nunca viu. Pare os programas de `rota/`; essa pasta será usada de novo em 3.3.4.

#### 3.2.3 No verde: a tag como prova de que versão se leu

A solução tem duas peças que já são conhecidas da Lição 1:

- **`ETag`**: cada vez que o `revisor` entrega um serviço, coloca nele uma tag que muda cada vez que o serviço muda. No `revisor` é `"id-versão-inicialização"`: o id do serviço, um número de versão que sobe a cada alteração, e os oito dígitos sorteados na inicialização.
- **Um cabeçalho condicional**: na Lição 1, `If-None-Match` dizia «envie só se mudou». Agora `If-Match` diz o contrário: «**faça isto só se não mudou**», ou mais exatamente, só se a tag vigente for a que li.

Com isso, cada cliente envia, junto com sua alteração, a tag da versão sobre a qual a escreveu. Se alguém alterou o serviço entre a leitura e a escrita, a tag já não coincide e o servidor se recusa: responde `412` e não aplica nada. O cliente não perdeu dados; perdeu uma corrida, e sabe disso.

Primeiro, o mesmo programa dos dois editores que em 3.2.2 perdeu a alteração de Ana. **Série B:** pare o `revisor` de `rota/`, inicie o laboratório e o `revisor` a partir de `fig03_01/`, e execute `fig03_02.ts` assim que ele iniciar:

```text
$ node fig03_02.ts
Ana      lee:    200 "1-1-c0466c5e" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
Beto     lee:    200 "1-1-c0466c5e" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
Ana      guarda: 200 "1-2-c0466c5e" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/204","limite_ms":2000}
Beto     guarda: 412 tu etiqueta ya no es la vigente: el servicio cambió o el revisor se reinició; vuelve a leerlo antes de cambiarlo
Beto     lee:    200 "1-2-c0466c5e" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/204","limite_ms":2000}
Beto     guarda: 200 "1-3-c0466c5e" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/204","limite_ms":3000}
Al final lee:    200 "1-3-c0466c5e" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/204","limite_ms":3000}
el cambio de Ana sigue ahí
```

Ana salvou (`200`, versão 2). Beto recebeu `412`, releu (agora vê o endereço de Ana), aplicou apenas a sua alteração e salvou (`200`, versão 3). No final estão as duas alterações. Ninguém precisou se coordenar por chat nem bloquear o serviço enquanto o editava: bastou que o servidor se recusasse a escrever sobre uma versão velha. Essa técnica se chama **concorrência otimista**: supõe-se que quase nunca haverá colisões, deixa-se todos trabalharem, e só se detém quem chega tarde.

Agora o mesmo, passo a passo, com `curl`. **Aqui começa a série A, a principal da lição:** pare o `revisor` e inicie-o de novo a partir de `fig03_01/`, para que o serviço 1 esteja como no começo. A partir daqui e até o final da seção 3.8, todas as requisições do `revisor` bom pertencem a esta mesma série; não o reinicie entre uma e outra, porque cada uma parte do que a anterior deixou. Primeiro lê-se o serviço 1 e guarda-se sua tag na variável `ETAG`, com a opção `-w '%header{etag}'` do `curl`, que imprime só esse cabeçalho. Essa leitura faz o papel de «Ana e Beto leem»:

```text
$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 200 OK
ETag: "1-1-c4dd49c4"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ ETAG=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ETAG=$ETAG"
ETAG="1-1-c4dd49c4"
```

Ana salva primeiro, com `If-Match` e a tag que leu. Muda o limite para 1500 ms:

```text
$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-2-c4dd49c4"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}
```

`200` e uma tag nova: a versão passou de 1 para 2. Agora chega Beto com **a mesma tag de antes**, a da versão 1, e uma alteração diferente:

```text
$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/500","limite_ms":2000}'
HTTP/1.1 412 Precondition Failed
Content-Type: text/plain; charset=utf-8
Content-Length: 115
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu etiqueta ya no es la vigente: el servicio cambió o el revisor se reinició; vuelve a leerlo antes de cambiarlo
```

`412 Precondition Failed`. A alteração de Beto não foi aplicada, e a de Ana continua intacta. O corpo diz o que aconteceu e o que fazer: sua tag já não é a vigente, porque o serviço mudou (ou porque o `revisor` reiniciou, o que também invalida as tags), e ele precisa relê-lo antes de alterá-lo. Não repete a tag que Beto enviou: Beto já a tem, e devolver ao cliente um texto que ele mesmo escreveu só aumenta a resposta sem lhe dizer nada de novo.

### 3.3 `If-Match` e o `412`

#### 3.3.1 Por que `If-Match` é comparado em modo forte

A Lição 1 ensinou que há duas formas de comparar tags, e a [seção 8.8.3.2 do RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.2) as define com uma tabela:

| Tag 1 | Tag 2 | Comparação forte | Comparação fraca |
|---|---|---|---|
| `W/"1"` | `W/"1"` | não coincide | coincide |
| `W/"1"` | `W/"2"` | não coincide | não coincide |
| `W/"1"` | `"1"` | não coincide | coincide |
| `"1"` | `"1"` | coincide | coincide |

Uma tag **fraca** (`W/` na frente) promete pouco: que duas representações são «equivalentes», ainda que os bytes não sejam idênticos. Serve para o cache, e por isso `If-None-Match` é comparado em modo fraco. Uma tag **forte** promete que os bytes são exatamente os mesmos.

`If-Match` é comparado **em modo forte**, e a [seção 13.1.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1) o exige com um **deve**: o servidor de origem deve usar a comparação forte porque o cliente quer impedir que o método seja aplicado **se houve qualquer mudança** nos dados da representação. Uma tag fraca não pode garantir isso: duas versões «equivalentes» podem diferir em algo que ao cliente sim importa. Por isso, com comparação forte, uma tag `W/` **nunca** coincide com nada, nem sequer com a sua gêmea.

A especificação também diz o que o cabeçalho traz: `*` ou uma **lista** de tags separadas por vírgulas (`If-Match = "*" / #entity-tag`). E dá três passos para avaliá-lo:

1. Se for `*`, a condição é cumprida se o recurso tem uma representação atual, isto é, se existe.
2. Se for uma lista, é cumprida se **alguma** das tags coincide com a vigente.
3. Em qualquer outro caso, não é cumprida.

`etiquetas.ts`, que vem sem alterações desde a Lição 1, já faz tudo isso: `interpretarLista` lê a lista respeitando as aspas, `coincideFuerte` compara duas tags como a tabela pede, e `hayCoincidencia` junta as duas coisas. O novo é quem a chama com `coincideFuerte`: o handler `cambiar`, em `servicios.ts`.

#### 3.3.2 As três formas que coincidem e a que não

Para comprová-lo, na mesma série A, lê-se a tag vigente (agora a versão 2, depois da alteração de Ana) e guarda-se em `VIGENTE`. Depois envia-se uma alteração com essa mesma tag, mas marcada como fraca:

```text
$ VIGENTE=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "VIGENTE=$VIGENTE"
VIGENTE="1-2-c4dd49c4"

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: W/$VIGENTE" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 412 Precondition Failed
Content-Type: text/plain; charset=utf-8
Content-Length: 109
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

If-Match se compara en fuerte: una etiqueta débil (W/) no sirve para cambiar; manda la ETag tal como llegó
```

`412`, ainda que o texto entre aspas seja exatamente o vigente. Repare no corpo: não diz que o serviço mudou, porque não mudou. Diz que uma tag fraca não serve para alterar e que é preciso enviá-la exatamente como chegou. O `revisor` sabe disso porque, quando a comparação forte falha, tenta também a fraca: se essa sim coincide, o problema não é que o serviço tenha mudado, e sim que o cliente acrescentou `W/` à tag (pode acontecer sem que o cliente a tenha escrito: desde a versão 1.7.3, de 2014, o servidor web nginx converte em fraca uma tag forte quando modifica a resposta, por exemplo ao comprimi-la, segundo sua [lista de mudanças](https://nginx.org/en/CHANGES); esse caso tem sua própria complicação, explicada dois parágrafos abaixo). Dizer-lhe que o serviço mudou seria falso, e mandaria o cliente reler em um ciclo que nunca termina.

Há um caso em que o conselho do corpo, «envie a `ETag` exatamente como chegou», não basta: o do nginx. Se foi um intermediário que enfraqueceu a tag, ao cliente ela **chegou** fraca, e enviá-la exatamente como chegou repete o `412` a cada tentativa enquanto o intermediário continuar enfraquecendo a tag. Esse problema o cliente não pode resolver: quem opera a API precisa evitar que o intermediário modifique essas respostas (por exemplo, não comprimir as que levam uma tag que será usada para escrever) ou usar tags que sobrevivam à modificação. Por isso o corpo diz a causa exata e não um «algo falhou» genérico: a pessoa que o ler sabe que o problema está na tag fraca, e a quem avisar. **O código manda e o corpo explica, e os dois dizem o mesmo**: os dois dizem «a condição não foi cumprida», e o corpo acrescenta por quê.

Agora, uma lista que traz a tag vigente junto com outra que não existe, e depois `*`:

```text
$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: \"9-9\", $VIGENTE" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-3-c4dd49c4"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: *' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-4-c4dd49c4"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}
```

As duas dão `200`. A lista coincide porque **alguma** tag coincide. `*` coincide porque o serviço existe. E cada alteração subiu a versão: `"1-3-…"` e depois `"1-4-…"`.

Para que serve `If-Match: *` se não protege contra a alteração de outra pessoa? Para outra coisa: diz «faça isto só se o recurso existe». Em uma API em que o `PUT` pode **criar** um recurso, `If-Match: *` impede criar um por acidente quando a intenção era alterá-lo; e seu contrário, `If-None-Match: *`, impede sobrescrever um que já existia quando a intenção era criá-lo. No `revisor`, o `PUT` nunca cria (um serviço que não existe dá `404`), então `*` só poupa o cliente de ler a tag. Por isso, **quem envia `*` renuncia à proteção contra a atualização perdida**. É válido, a especificação o permite, mas é uma decisão do cliente, e convém que ele a tome com conhecimento de causa.

#### 3.3.3 O código de `cambiar`

Este é o handler, completo em `servicios.ts` (seção 3.9). O que importa está nas primeiras linhas:

```ts
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
  // …
```

Lê-se na ordem de 3.1.3: primeiro `encontrar` (existe ou não, para esta credencial), depois `esJson`, que só olha o cabeçalho `Content-Type` (`415`), depois a condição, e só então o corpo. Antes de ler o corpo, `cambiar` anota **que versão coincidiu**, em `versionLeida`; com `If-Match: *` anota `null`, porque `*` não fala de nenhuma versão, apenas pede que o serviço exista. Essa anotação parece demais, porque a comparação já foi feita. A seção seguinte mostra por que não é.

#### 3.3.4 Duas requisições ao mesmo tempo: comparar e escrever em um único passo

Entre a comparação da tag e a escrita, `cambiar` espera duas vezes: `await leerJson(…)`, enquanto o corpo chega, e `await destinoPermitido(…)`, enquanto o DNS resolve o nome da URL. Em cada `await`, o Node deixa de atender esta requisição e atende outras. Se nesse intervalo chega outro `PUT` com a **mesma** tag, ele também passa na comparação, porque ninguém escreveu ainda. As duas requisições seguem adiante convencidas de que o serviço está como o leram, e a que escrever por último sobrescreve a outra. É a atualização perdida outra vez, agora com dois clientes que **enviaram** `If-Match` a um servidor que **o comparou**.

**Primeiro, no vermelho.** Para vê-la sem depender da sorte, uma das duas requisições precisa ficar esperando no intervalo de propósito. `curl -T -` envia o corpo que lê de sua entrada, conforme ele chega; se a entrada demora, a requisição envia seus cabeçalhos de imediato e fica esperando o corpo, justamente no `await leerJson`. A «lenta» quer colocar o limite em 1000 ms e seu corpo chega um segundo depois; aos 0,3 segundo, a «rápida» quer colocá-lo em 3000 ms, com a mesma tag. A versão quebrada é uma série à parte, a D, e interrompe a série A. Se preferir não interrompê-la, pule este vermelho e execute-o ao terminar a lição; se o executar agora, ao voltar será preciso iniciar de novo o `revisor` de `fig03_01/` e repetir a série A desde 3.2.3 até aqui para que as respostas coincidam com as da lição.

Para a versão quebrada, crie a cópia **do zero**: `rm -r rota && cp -R fig03_01 rota`. O `rm` não é demais: se `rota/` já existe, `cp -R` coloca a pasta dentro (`rota/fig03_01/`) e `rota/` fica com a versão de 3.2.2. Depois faça uma única alteração em `rota/servicios.ts`: em `cambiar`, passe a `cambiarServicio` `null` em vez de `versionLeida`. Com isso, a comparação do começo continua no lugar, mas ao escrever já não se compara nada (versão completa em `defectos/una-sola-comparacion/servicios.ts`).

**Série D:** pare o `revisor` que estiver executando e inicie o laboratório e o `revisor` a partir de `rota/`. Antes da corrida, comprove que está executando a cópia correta, porque o resultado vermelho da corrida é igual nas duas versões quebradas e não avisaria do erro. Um `PUT` com uma tag inventada **tem que** dar `412`, porque a comparação do começo continua viva; se der `200`, está executando a cópia de 3.2.2:

```text
$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: "1-9-00000000"' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 412 Precondition Failed
Content-Type: text/plain; charset=utf-8
Content-Length: 115
Date: Wed, 21 Oct 2026 13:18:31 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu etiqueta ya no es la vigente: el servicio cambió o el revisor se reinició; vuelve a leerlo antes de cambiarlo
```

`412`: a primeira comparação funciona. Agora sim, a corrida:

```text
$ ETAG=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ETAG=$ETAG"
ETAG="1-1-4ac4936c"

$ ( sleep 1; printf '%s' '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1000}' ) | curl -sS -w 'lenta: %{http_code}\n' -X PUT -T - http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" & LENTA=$!; sleep 0.3; curl -sS -o /dev/null -w 'rápida: %{http_code}\n' -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}'; wait $LENTA
rápida: 200
{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1000}
lenta: 200

$ curl -sS http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1000}
```

As duas receberam `200`; a lenta imprimiu o serviço que lhe devolveram. E o valor que ficou é o da **lenta**, 1000, embora a rápida tenha salvado primeiro e também recebido `200`. O cliente da rápida acredita que o limite é 3000; o servidor diz 1000; ninguém recebeu um erro. A comparação do começo foi feita (a verificação acima prova isso), e não serviu, porque quando a lenta escreveu ela já não era verdadeira.

Se a corrida for digitada no terminal, aparecerá também uma linha como `[1] 12345` ao lançar a lenta, e outra avisando que terminou (`[1]+ Done …` no bash, `[1] + done …` no zsh): são do shell, que avisa sobre os jobs em segundo plano, não do `revisor`.

**Depois, no verde.** A correção é comparar **outra vez, no momento de escrever**, sem nenhum `await` entre a comparação e a escrita. É o que faz `cambiarServicio` em `almacen.ts`:

```ts
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
```

É uma função **síncrona**: não tem nenhum `await`, então o JavaScript a executa do início ao fim sem atender nenhuma outra requisição no meio. Ninguém pode se enfiar entre o `if` que compara a versão e o `Object.assign` que escreve. Se a versão já não é a que `cambiar` anotou, não escreve nada e devolve `"conflicto"`, e `cambiar` responde `412`. E se o serviço já não existe, porque outra requisição o retirou nesse intervalo, devolve `"retirado"`, e `cambiar` responde `410`; a seção 3.7.3 o provoca:

```ts
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
```

A mesma corrida contra o `revisor` desta lição, **na série A**, logo depois das requisições de 3.3.2 (se a série D foi executada, inicie de novo `fig03_01/` e repita antes a série A desde 3.2.3; se não for repetida, a tag dirá `"1-1-…"` em vez de `"1-4-…"` e o que vem em 3.4 a 3.8 não coincidirá com a lição):

```text
$ ETAG=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ETAG=$ETAG"
ETAG="1-4-c4dd49c4"

$ ( sleep 1; printf '%s' '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1000}' ) | curl -sS -w 'lenta: %{http_code}\n' -X PUT -T - http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" & LENTA=$!; sleep 0.3; curl -sS -o /dev/null -w 'rápida: %{http_code}\n' -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}'; wait $LENTA
rápida: 200
el servicio cambió mientras se atendía tu petición; vuelve a leerlo antes de cambiarlo
lenta: 412

$ curl -sS http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}
```

A rápida, `200`; a lenta, `412`, com um corpo diferente do de uma tag velha: o serviço mudou **enquanto** sua requisição era atendida. E o valor que ficou é o da rápida, 3000, o mesmo que seu cliente acredita que ficou. Nenhuma escrita se perdeu: uma foi aplicada, a outra foi rejeitada e seu cliente sabe disso.

Por que não mover toda a comparação para o final e comparar uma única vez? Fecharia o intervalo do mesmo jeito, mas obrigaria a esperar o corpo completo e a consultar o DNS para uma tag que já se sabe velha desde a primeira linha. Por isso `cambiar` compara duas vezes: no começo, para rejeitar barato o que já chegou vencido; ao escrever, para não aceitar o que venceu no caminho.

**O equivalente em um banco de dados.** Uma API real não guarda seus dados em um `Map`, mas o problema e a solução são os mesmos. Ler a versão com um `SELECT` e depois escrever com um `UPDATE` separado deixa o mesmo intervalo entre as duas instruções. A forma de sempre é colocar a versão na condição da escrita: `UPDATE servicios SET … , version = version + 1 WHERE id = 1 AND version = 4`. O banco de dados compara e escreve em uma única operação, e informa quantas linhas tocou; se tocou zero, outro chegou antes, e a resposta é `412`. `cambiarServicio` é exatamente isso, escrito em memória. E um limite honesto: a atomicidade de uma função síncrona vale dentro de **um** processo do Node. Se o `revisor` rodasse em várias instâncias (processos, réplicas atrás de um balanceador), cada uma com seu próprio `Map`, já não há um único lugar onde comparar e escrever; essa comparação precisa viver onde os dados são compartilhados, no banco de dados, com o `UPDATE … WHERE version = N`.

### 3.4 `412` versus `428`

#### 3.4.1 Quando o cliente não envia a condição

Tudo o que precede funciona se o cliente envia `If-Match`. E se não enviar? Para o servidor, um `PUT` sem condição é exatamente o `PUT` da cena do começo: escrever sem saber sobre qual versão. Poderia aceitá-lo, e então a proteção depende de que todos os clientes se lembrem de enviar o cabeçalho. Ou pode **exigi-lo**.

Para isso existe o **`428 Precondition Required`**, que não está no RFC 9110, e sim no [RFC 6585, seção 3](https://www.rfc-editor.org/rfc/rfc6585.html#section-3), de abril de 2012. Sua definição é de uma linha: o servidor de origem **exige que a requisição seja condicional**. E a frase seguinte diz para quê: seu uso típico é evitar a atualização perdida, quando um cliente lê o estado de um recurso, o modifica e o devolve com `PUT` enquanto um terceiro já o alterou. O RFC acrescenta duas regras: a resposta **deveria** explicar como reenviar a requisição com sucesso (seu próprio exemplo diz «tente com `If-Match`»), e **não deve** ser armazenada em cache.

```text
$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 428 Precondition Required
Content-Type: text/plain; charset=utf-8
Content-Length: 52
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

para cambiar un servicio manda If-Match con su ETag
```

O corpo diz o que fazer, como o RFC pede: enviar `If-Match` com a `ETag`. Para saber qual, o cliente precisa ler o serviço primeiro, que é justamente o que ele deixou de fazer.

#### 3.4.2 A diferença em uma tabela

| | `412 Precondition Failed` | `428 Precondition Required` |
|---|---|---|
| A condição veio? | sim | não |
| O que aconteceu? | a condição foi avaliada e resultou falsa | não há nada a avaliar |
| O que diz? | «o recurso mudou desde que foi lido» (ou a tag não serve) | «não escrevo sem saber que versão foi lida» |
| O que o cliente faz? | lê de novo, refaz sua alteração sobre a cópia nova, envia a tag nova | lê e envia a tag |
| Pode repetir a mesma requisição tal qual? | não: receberá `412` outra vez | não: receberá `428` outra vez |
| Definido em | RFC 9110, seção 15.5.13 | RFC 6585, seção 3 |

As duas respostas mandam o cliente **ler**, mas por razões distintas, e um programa as trata de modo distinto: depois de um `412`, o programa precisa **mesclar** sua alteração com o que encontrou, porque outra pessoa escreveu; depois de um `428`, faltou apenas um passo, e o que encontrar ao ler é o mesmo que já tinha. Por isso não se juntam em um único código.

Por que o `revisor` exige a condição em vez de apenas recomendá-la? Porque, em uma API que administra configuração compartilhada, como a lista de serviços que uma equipe vigia, uma atualização perdida não avisa: é descoberta horas depois, como na cena. Exigir `If-Match` custa ao cliente uma leitura; não exigi-lo pode custar uma noite sem vigilância. É uma decisão de projeto, não uma obrigação do HTTP: o RFC 6585 permite exigi-la, não obriga a fazê-lo. Há APIs que decidem de outro modo, e isso aparecerá em 3.5.3.

### 3.5 Conflito de estado: `409`

#### 3.5.1 O nome repetido

O `revisor` tem uma regra: dentro de uma equipe, dois serviços não podem ter o mesmo nome. É uma regra razoável (o nome é o que se lê nos painéis e nos alertas, e dois «pagos» confundiriam qualquer um), e é uma regra **de estado**: não depende do nome em si, e sim de que outros serviços existem. Assim se vê quando a equipe a tenta cadastrar um segundo `pagos`:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: text/plain; charset=utf-8
Content-Length: 50
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya existe un servicio llamado pagos: /servicios/2
```

`409 Conflict`. O corpo cumpre o **deveria** da seção 15.5.10: diz com o que colide (`/servicios/2`), para que o cliente possa reconhecer a origem do conflito e decidir: mudar o nome, ou consultar o serviço que já existe, porque talvez seja o que procurava. A Lição 5 colocará esse endereço em um campo próprio do corpo, `existente`, para que um programa o leia sem interpretar a frase.

O mesmo acontece em uma alteração que tenta dar a um serviço o nome de outro. Aqui o cliente envia `If-Match: *`, então a condição é cumprida; o que falha é o que vem depois:

```text
$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: *' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: text/plain; charset=utf-8
Content-Length: 50
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya existe un servicio llamado pagos: /servicios/2
```

E a prova de que é um conflito de estado e não uma regra sobre os dados: a **mesma** requisição de cadastro, byte a byte, com a credencial da equipe b, que não tem nenhum `pagos`:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-b' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/4
ETag: "4-1-c4dd49c4"
Content-Type: application/json
Content-Length: 85
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

`201`. Os dados eram válidos; o que mudou foi o estado contra o qual foram comparados. Essa é a prova de fogo do `409`: **se a mesma requisição poderia funcionar em outro momento ou em outro contexto sem mudar nada nela, a falha é de estado, não de dados.**

#### 3.5.2 `409` e não `422`, `409` e não `412`

Por que não `422`? Porque o `422` diz «o que foi enviado não pode ser cumprido», e um cliente que o recebe corrige seus dados. Aqui os dados não têm nada a corrigir. Há APIs grandes que decidem de outro modo: a do GitHub responde `422` com o código `already_exists` quando outro recurso já usa o mesmo valor único, como o nome de um rótulo (label) ([documentação de sua API REST](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api)). É uma decisão coerente dentro da API deles, e está documentada; o curso prefere `409` porque a especificação o descreve justamente para o conflito que o usuário pode resolver e reenviar.

Por que não `412`? Porque o cliente não colocou nenhuma condição. O `412` responde a um cabeçalho condicional que o cliente enviou e que resultou falso. O cliente que cadastra `pagos` não disse «crie só se não existir outro com esse nome»; o servidor tem essa regra por conta própria. Quando a regra é do servidor e a colisão é com o estado, o código é `409`.

#### 3.5.3 Quando a versão viaja no corpo

Há um caso em que a fronteira entre `409` e `412` se move, e a própria seção 15.5.10 o menciona: diz que os conflitos são mais prováveis em um `PUT`, e dá como exemplo uma API **com versões** em que a representação enviada traz mudanças que colidem com as de uma requisição anterior de um terceiro. Isso é a atualização perdida. Então a atualização perdida é `409` ou `412`?

Depende de **onde viaja a condição**:

- Se a versão que o cliente leu viaja em um **cabeçalho condicional** (`If-Match`), o servidor avalia uma pré-condição do HTTP, e se ela falha, a resposta é `412`. É o que o `revisor` faz.
- Se a versão viaja **dentro do corpo** (um campo `"version": 7` no JSON), para o HTTP não há nenhuma pré-condição: faz parte dos dados. O servidor descobre a colisão ao comparar o corpo com seu estado, e a resposta é `409`.

As duas formas existem em APIs reais. As diretrizes de projeto do Google ([AIP-154](https://google.aip.dev/154)) colocam a tag como um campo do recurso e pedem responder `ABORTED` quando não coincide, um erro que sua tabela de equivalências traduz como `409 Conflict`; a mesma tabela manda `INVALID_ARGUMENT` e `FAILED_PRECONDITION` para `400` ([`google.rpc.Code`](https://github.com/googleapis/googleapis/blob/master/google/rpc/code.proto)). E a AIP-154 não exige a tag: deixa passar a requisição sem ela, exceto em serviços que precisam de consistência estrita. As diretrizes de API da Zalando, por sua vez, preveem `ETag` com `If-Match` como uma opção (sua regra 182 é um «pode», não um «deve»), e sua tabela de códigos atribui o `412` à condição que falha e o `428` à condição que se exige ([*Zalando RESTful API Guidelines*](https://opensource.zalando.com/restful-api-guidelines/)). O curso segue a segunda forma porque usa a maquinaria que o HTTP já traz para isso, e porque qualquer intermediário do caminho entende um cabeçalho padrão; um campo `version` no corpo só o cliente próprio entende.

Mais uma nota sobre o `409`, para não confundi-lo adiante: na [Lição 6](06-reintentos-idempotencia.md) aparece outro `409`, quando chega uma requisição com um cabeçalho `Idempotency-Key` enquanto a original com a mesma chave ainda está em andamento. Esse comportamento vem de um rascunho (draft) da IETF, `draft-ietf-httpapi-idempotency-key-header-07`, que expirou em 18 de abril de 2026 sem ser publicado como RFC: **não é um padrão**, e a Lição 6 o trata como o que é. É outro conflito com o estado atual, e por isso o rascunho escolheu o mesmo código.

### 3.6 Regra de negócio: `422`, e a política de `400` versus `422`

#### 3.6.1 A política escrita

Na Lição 2, tudo o que não servia no corpo respondia `400`. A partir desta lição, o `revisor` separa dois casos, e o faz com uma regra escrita, porque é uma das duas decisões que o curso toma como **política** e não como intuição:

- **`400 Bad Request`: não pode ser lido.** O corpo não é JSON, ou é JSON mas não é um objeto (`null`, um número, um texto, uma lista). Não há como saber sequer que campos trazia. (Um corpo de mais de 16 KiB nem chega a ser lido por completo: o `revisor` para de guardá-lo assim que passa desse limite e responde `413 Content Too Large`, para que ninguém lhe encha a memória com um corpo gigantesco.)
- **`422 Unprocessable Content`: é lido, mas não pode ser cumprido.** O corpo é um objeto JSON, entende-se que campos traz, mas algum falta, tem o tipo errado ou um valor fora da faixa, ou o endereço aponta para um destino proibido.

As regras do `revisor` são quatro: `nombre` é um texto de 1 a 40 caracteres; `url` é um endereço `http` ou `https`; `limite_ms`, se vier, é um inteiro de 100 a 10.000 (se não vier, vale 2000); e o destino de `url` não pode ser um endereço privado ou reservado (o SSRF da Lição 1).

A regra do meio merece atenção: **juntam-se todas as falhas, não só a primeira.** Um cliente que recebe «o nome está errado», o corrige, recebe «o endereço está errado», o corrige e recebe «o limite está errado» fez três viagens para algo que se podia dizer em uma. Assim se veem as três falhas juntas, e o `400` de um corpo que não é um objeto:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"","url":"ftp://archivos","limite_ms":5}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 137
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

nombre: debe ser un texto de 1 a 40 caracteres
url: debe ser una dirección http o https
limite_ms: debe ser un entero entre 100 y 10000

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '["inventario"]'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 31
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo no es un objeto JSON
```

Uma linha por campo, cada uma com o nome do campo na frente. A Lição 5 converte essas linhas em uma lista `errors` com um `pointer` por campo (`"#/nombre"`), como o exemplo da [seção 3 do RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html#section-3), para que um formulário possa marcar cada campo sem interpretar texto.

O tipo errado também é `422`, ainda que se pareça com um problema de leitura. Aqui `limite_ms` chegou como texto (`"2000"`), não como número:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":"2000"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 48
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

limite_ms: debe ser un entero entre 100 y 10000
```

O JSON foi lido sem problema; o que não cumpre é a regra «inteiro de 100 a 10.000». Se o `revisor` convertesse o texto em número por conta própria, aceitaria também `"2000abc"` ou `" 2000 "`, conforme a forma de converter, e cada cliente aprenderia uma regra diferente. É melhor dizer com exatidão o que se esperava.

#### 3.6.2 O destino proibido também é `422`

A defesa contra SSRF da Lição 1 continua igual, mas muda de código. Antes respondia `400`, porque o `422` ainda não existia; agora a URL é lida perfeitamente, é um endereço `http` válido, e o que não pode ser cumprido é a regra «o `revisor` não se conecta a endereços privados ou reservados»:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"metadatos","url":"http://169.254.169.254/latest/meta-data/"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 70
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: 169.254.169.254:80: dirección privada o reservada

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"yo-mismo","url":"http://localhost:18080/mantenimiento"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 75
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: localhost resuelve a una dirección privada o reservada
```

O texto é o mesmo das lições anteriores. No segundo caso, a mensagem diz apenas que `localhost` resolve para um endereço privado ou reservado, sem enumerar quais: o que um nome resolve muda conforme o sistema, e a lista revelaria ao cliente a rede interna do servidor sem lhe servir de nada.

#### 3.6.3 Outras diretrizes decidem de outro modo

A política do curso não é a única razoável, e vale a pena conhecer o que outros fazem, porque se encontrarão APIs dos dois lados:

- As diretrizes da **Zalando** dizem que o `400` também deve ser usado quando o corpo não passa na validação de negócio ou semântica, «em vez de usar `422`», e marcam o `422` como «não usar»: segundo elas, o `400` já cobre quase todos os casos e não veem benefício claro em distingui-los.
- As do **Google** traduzem seus erros de argumento inválido (`INVALID_ARGUMENT`) para `400`.
- A API do **GitHub**, como se viu em 3.5.2, usa `422` para a validação, e até para os valores repetidos.

O curso fica com a fronteira «ler versus cumprir» por uma razão que tem a ver com quem recebe o erro: um `400` diz ao cliente que **algo na forma** de sua requisição está quebrado, normalmente um erro de programação que é preciso corrigir no código; um `422` diz que a forma está certa e que **os valores** não são aceitos, normalmente algo que uma pessoa escreveu e que se pode mostrar em um formulário. São duas ações distintas, e a especificação tem um código para cada uma. O que importa mais do que a fronteira exata é que a API a **escreva** e a aplique igual em todas as suas rotas: um cliente pode se adaptar a qualquer uma das duas políticas; a uma API que usa as duas ao acaso, não.

### 3.7 O recurso que se foi: `410` versus `404`

#### 3.7.1 O que o `404` não diz

Na Lição 2, retirar um serviço o apagava do armazenamento, e depois seu identificador respondia `404`, igual a um que nunca existiu. Para o cliente, as duas situações são muito diferentes. Se um serviço **nunca existiu**, talvez o cliente tenha errado o número e valha a pena conferir. Se **existiu e foi retirado de propósito**, não há nada a conferir: é preciso parar de pedi-lo, apagá-lo da configuração, remover o link do painel.

A [seção 15.5.5 do RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.5) diz que um `404` **não indica** se a ausência é temporária ou permanente, e que se prefere o `410` se o servidor sabe que a condição provavelmente é permanente. A [seção 15.5.11](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.11) define o **`410 Gone`**: o recurso já não está disponível no servidor de origem, e é provável que seja para sempre. Se o servidor não sabe, ou não tem como saber, se é permanente, deveria usar `404`. E explica a intenção: avisar que o recurso **foi retirado de propósito** e que seus donos querem que se removam os links que apontam para ele.

Para poder responder `410`, o `revisor` precisa **lembrar** o que retirou. Por isso `almacen.ts` tem agora um segundo mapa, `retirados`, que guarda o id de cada serviço retirado junto com a equipe a que pertencia. Assim ele responde:

```text
$ curl -i -X DELETE http://127.0.0.1:18080/servicios/2 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/2 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 410 Gone
Content-Type: text/plain; charset=utf-8
Content-Length: 42
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 2 se retiró y no va a volver

$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 25
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 99
```

O serviço 2 foi retirado: `410`, e o corpo diz isso sem rodeios, «não vai voltar». O 99 nunca existiu: `404`. O cliente já pode tratar cada caso de modo distinto só de olhar o código.

Mais dois detalhes da especificação. Primeiro, o `410` é **cacheável por heurística**, assim como o `404`: um cache pode armazená-lo ainda que não traga instruções de cache, e é correto, porque o recurso não vai voltar. Segundo, não é obrigatório marcar tudo o que foi retirado como `410` nem lembrá-lo para sempre: a especificação deixa isso ao critério de quem opera o servidor. O `revisor` o lembra enquanto está ligado; como guarda tudo em memória, ao reiniciá-lo um serviço retirado volta a dar `404`. Em uma API com banco de dados, a linha seria marcada como retirada em vez de apagada.

#### 3.7.2 O `410` não se diz a qualquer um

O `410` diz mais do que «não está»: diz «**esteve**». Isso, para quem não devia saber que existiu, é informação. Na Lição 2, o `revisor` decidiu que um serviço de outra equipe responde `404`, igual a um que não existe, para que ninguém possa enumerar o que é alheio comparando respostas. Se agora o serviço 2 da equipe a respondesse `410` a qualquer um, a equipe b poderia percorrer os identificadores e descobrir quais existiram na equipe a e quando foram retirados. Por isso `encontrar` só responde `410` **à equipe dona**; às demais responde o mesmo `404` de sempre:

```text
$ curl -i http://127.0.0.1:18080/servicios/2 -H 'Authorization: Bearer escritura-b'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 2
```

O mesmo `404`, com o mesmo texto do serviço 99. Para a equipe b, o serviço 2 nunca existiu, que é o que a equipe b tinha permissão de saber. Esta é a função que decide, em `servicios.ts`:

```ts
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
```

Uma única função para consultar, alterar, retirar e pedir verificação: assim nenhum handler pode esquecer a comparação da equipe, e o `410` e o `404` saem sempre das mesmas duas linhas. «O erro a ser observado» mostra o que acontece se `delEquipo` for retirado da segunda condição.

#### 3.7.3 O `410` vence a condição

Um `PUT` com `If-Match: *` a um serviço retirado. `*` significa «se existe»; o serviço não existe, então a condição seria falsa e poderíamos esperar um `412`:

```text
$ curl -i -X PUT http://127.0.0.1:18080/servicios/2 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: *' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 410 Gone
Content-Type: text/plain; charset=utf-8
Content-Length: 42
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 2 se retiró y no va a volver
```

É `410`, pela regra de 3.1.3: a seção 13.2.1 pede que se ignorem as pré-condições se, sem elas, a resposta não teria sido um `2xx` nem um `412`. Sem `If-Match`, este `PUT` teria recebido `410`; então a condição nem é avaliada. E é a resposta mais útil: um `412` mandaria o cliente reler, e ao reler ele receberia `410` de qualquer jeito.

O mesmo vale quando a retirada ocorre **durante** a alteração, no intervalo de 3.3.4. Cadastra-se um serviço, `efimero`, e guardam-se seu endereço e sua tag. Depois, a mesma corrida de antes, com outro rival: enquanto um `PUT` lento espera seu corpo, um `DELETE` retira o serviço:

```text
$ ID=$(curl -sS -o /dev/null -w '%header{location}' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"efimero","url":"http://127.0.0.1:18081/codigo/200"}'); ETAG=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a'); echo "ID=$ID ETAG=$ETAG"
ID=/servicios/5 ETAG="5-1-c4dd49c4"

$ ( sleep 1; printf '%s' '{"nombre":"efimero","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}' ) | curl -sS -w 'lento: %{http_code}\n' -X PUT -T - http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" & LENTO=$!; sleep 0.3; curl -sS -o /dev/null -w 'DELETE en el hueco: %{http_code}\n' -X DELETE http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a'; wait $LENTO
DELETE en el hueco: 204
el servicio 5 se retiró y no va a volver
lento: 410
```

O `DELETE` chegou no intervalo e respondeu `204`. Quando o `PUT` lento finalmente escreveu, `cambiarServicio` já não encontrou o serviço, devolveu `"retirado"`, e a resposta foi `410`, com o mesmo corpo de um `GET` a um serviço retirado: como se o `PUT` tivesse chegado depois da retirada, que é o que de fato lhe aconteceu. Um `412` aqui mandaria o cliente reler, para dar de cara com o `410` na requisição seguinte; com o `410` ele fica sabendo logo na primeira.

### 3.8 Versões da API: o `410` anunciado

#### 3.8.1 Retirar uma versão sem surpreender ninguém

Um serviço retirado é um caso pequeno do mesmo problema que toda API que cresce tem: **retirar uma versão velha**. O `revisor` tem três gerações de rotas:

- `/servicios`: a versão atual.
- `/v1/servicios`: a versão anterior. Continua funcionando, mas está **descontinuada** (*deprecated*): falava de `direccion` em vez de `url`, e do limite em segundos (`"limite": 3` para 3000 ms) em vez de milissegundos.
- `/v0/…`: a primeira versão, já **retirada**. Qualquer rota dela responde `410`.

Se um dia a `/v1` passasse de responder `200` a responder `410` sem aviso, cada cliente que ainda a usasse ficaria sabendo por um erro em produção. O correto é avisar **antes**, em cada resposta da `/v1`, para que quem a usa tenha tempo de migrar. Para isso há dois cabeçalhos, e eles não têm o mesmo peso:

- **`Deprecation`**, do [RFC 9745](https://www.rfc-editor.org/rfc/rfc9745.html) (março de 2025, **padrão proposto** da IETF). Seu valor é a data em que o recurso **ficou ou ficará** descontinuado; pode estar no passado («ficou descontinuado nessa data») ou no futuro («ficará»). A data vai no formato dos campos estruturados do HTTP: `@` seguido dos segundos desde 1º de janeiro de 1970 (seção 2.1).
- **`Sunset`**, do [RFC 8594](https://www.rfc-editor.org/rfc/rfc8594.html) (maio de 2019, documento **informativo**, não de padrões). Seu valor é a data em que o recurso **provavelmente deixará de responder**, no formato de data do HTTP de sempre (`Sun, 31 Jan 2027 00:00:00 GMT`). Foi publicado como proposta individual de seu autor, revisada pela IETF mas sem passar por um grupo de trabalho ([sua ficha no datatracker da IETF](https://datatracker.ietf.org/doc/rfc8594/)).

Que um seja padrão proposto e o outro informativo não muda como são usados; muda o quanto se pode esperar que clientes e ferramentas os conheçam. E nenhum dos dois obriga a nada: são **avisos**. O RFC 9745 diz em sua seção 5 que descontinuar um recurso não muda seu comportamento: quem o usa pode continuar usando-o igual. O RFC 8594, em sua seção 3, diz que os clientes **deveriam** tratar `Sunset` como uma pista: não há garantia de que o recurso funcione até essa data, nem de que deixe de funcionar depois.

Aos dois se soma um link: o RFC 9745 registra a relação `deprecation` para o cabeçalho `Link` (seção 3), que aponta para a documentação da descontinuação, por exemplo o guia de migração. Assim responde a `/v1` do `revisor`:

```text
$ curl -i http://127.0.0.1:18080/v1/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 200 OK
Deprecation: @1782864000
Sunset: Sun, 31 Jan 2027 00:00:00 GMT
Link: <https://revisor.example/docs/migrar-de-v1>; rel="deprecation"; type="text/html"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","direccion":"http://127.0.0.1:18081/codigo/200","limite":3}

$ curl -i http://127.0.0.1:18080/v1/servicios -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Deprecation: @1782864000
Sunset: Sun, 31 Jan 2027 00:00:00 GMT
Link: <https://revisor.example/docs/migrar-de-v1>; rel="deprecation"; type="text/html"
Content-Type: application/json
Content-Length: 104
Date: Wed, 21 Oct 2026 13:18:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","direccion":"http://127.0.0.1:18081/codigo/200","limite":3}]}
```

Os dados são os do serviço 1, no formato velho: `direccion` em vez de `url`, e `"limite":3`, os 3000 ms que a requisição «rápida» da corrida de 3.3.4 deixou, agora em segundos. E os três cabeçalhos vão em todas as respostas da `/v1`, na consulta e na lista: a descontinuação é do recurso em que o cabeçalho aparece (seção 2.2 do RFC 9745), então cada rota descontinuada o leva.

#### 3.8.2 A regra da ordem: `Sunset` nunca antes de `Deprecation`

As duas datas contam uma história em ordem: primeiro a versão **deixa de ser recomendada** (descontinuação) e, mais tarde, **deixa de responder** (retirada). A [seção 4 do RFC 9745](https://www.rfc-editor.org/rfc/rfc9745.html#section-4) faz disso uma regra com um **não deve**: a data de `Sunset` não deve ser anterior à de `Deprecation`. Se for (por um erro de configuração, diz o RFC), quem desenvolve o cliente deveria consultar quem opera o recurso para esclarecer.

A regra faz sentido mesmo que os dois sejam avisos. Uma retirada anterior à descontinuação diria «esta versão deixa de responder na segunda-feira, e é descontinuada na sexta», o que é uma contradição: ninguém teria tempo de migrar entre um aviso e o outro, porque o segundo chega quando já não há nada. O RFC 8594 explica isso pelo outro lado em sua seção 1.4: a descontinuação costuma ocorrer em duas etapas, primeiro «já não é a versão recomendada» e depois «é desativada», e `Sunset` só serve para a segunda.

No `revisor`, a `/v1` foi descontinuada em 1º de julho de 2026 (`@1782864000`) e deixa de responder em 31 de janeiro de 2027: sete meses de margem. O exercício 4 pede para comprovar isso com um programa, que é o que qualquer cliente que leia esses avisos deveria fazer.

#### 3.8.3 E, no final, o `410`

Quando chega a data, a versão é retirada e passa a responder `410`. É o que já aconteceu com a `/v0`:

```text
$ curl -i http://127.0.0.1:18080/v0/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 410 Gone
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

la versión 0 de la API se retiró el 31 de enero de 2026; usa /servicios

$ curl -i http://127.0.0.1:18080/v0/servicios
HTTP/1.1 410 Gone
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

la versión 0 de la API se retiró el 31 de enero de 2026; usa /servicios
```

`410` com qualquer credencial e também sem nenhuma, em qualquer rota que comece com `/v0`. Repare que a pergunta «é `/v0`?» vai no ponto de entrada **antes** da credencial, junto com os redirecionamentos antigos: uma versão retirada não tem nada a proteger, e um cliente velho que nem sabe se autenticar com o esquema atual merece saber que a versão se foi, e não que lhe falta uma credencial. O corpo diz quando foi retirada e aonde ir. É o mesmo raciocínio do `410` de um serviço, em ponto grande: o cliente não deve revisar seu código à procura de um erro de endereço; deve migrar.

O `410` é o final da história, não o começo. Uma API que retira uma versão respondendo `410` no primeiro dia em que alguém fica sabendo da retirada fez as coisas ao contrário: o `410` chega **depois** de meses de `Deprecation` e `Sunset` em cada resposta, e de um link com o guia de migração. A Lição 8 documenta esses avisos na descrição OpenAPI da API, com `deprecated: true` no que é retirado.

### 3.9 O `revisor` completo

#### 3.9.1 Os arquivos que mudam

O `revisor` desta lição vive na pasta `~/curso-http/fig03_01/`. Quem tem a pasta da Lição 2 deve copiá-la com esse nome e alterar quatro arquivos: um novo, `versiones.ts`, e três modificados, `almacen.ts`, `rutas.ts` e `servicios.ts`. Seguem completos aqui.

`versiones.ts` é novo. Tem as duas versões velhas: a `/v1`, com seus três avisos em `AVISOS` e sua forma velha de representar um serviço, e a `/v0`, que responde `410` a tudo:

```ts
// fig03_01/versiones.ts — las versiones viejas de la API: /v1 está desaprobada y /v0 ya se retiró.
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

Em `almacen.ts` há três funções novas e uma alterada: `retirarServicio` já não só apaga, também **lembra** a retirada em `retirados`, com a equipe; `equipoDeRetirado` a consulta; `buscarPorNombre` busca um nome dentro de uma equipe, para o `409`; e `cambiarServicio(id, versionLeida, datos)` compara a versão e aplica a alteração em um único passo, sem `await` (3.3.4): se a versão já não é a que foi lida, devolve `"conflicto"`; se é, escreve e **sobe a versão**, que é o que invalida a tag velha:

```ts
// fig03_01/almacen.ts — los servicios que observa el revisor y las revisiones pedidas, en memoria.
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

Em `rutas.ts` mudam três coisas: a rota `/servicios/{id}` admite agora `PUT` (e por isso o `Allow` de um `405` nessa rota passa a ser `GET, HEAD, PUT, DELETE`); há duas rotas novas para a `/v1`, somente leitura; e antes de buscar a rota, `versionRetirada` atende a `/v0`:

```ts
// fig03_01/rutas.ts — la puerta de la API: qué ruta existe, qué método admite y quién puede usarlo.
import type { IncomingMessage, ServerResponse } from "node:http";
import { identificar, motivo, reto, type Credencial } from "./autenticacion.ts";
import { enviarVacio, fallar } from "./respuestas.ts";
import {
  cambiar, consultar, consultarRevision, darDeAlta, listar, pedirRevision, retirar, type Contexto,
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
  { patron: /^\/revisiones\/(\d+)$/, metodos: { GET: lee(consultarRevision) } },
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

E `servicios.ts`, onde está quase tudo o que é desta lição: `encontrar` (3.7.2), `validar` e `rechazarDatos` (3.6.1), o `409` em `darDeAlta` e `cambiar` (3.5.1), `esJson`, que separa do leitor de JSON a pergunta pelo formato para que o `PUT` a faça antes da condição (3.1.3), e `cambiar` com seu `415`, seu `428`, seu `412` por tag velha (3.3.3) e seu segundo `412`, o da corrida (3.3.4), ou seu `410` se o serviço foi retirado no intervalo (3.7.3). `encontrar` agora é exportada porque `versiones.ts` também a usa. `representar` também ficou exportada, embora nesta lição nenhum outro arquivo a importe: a `/v1` tem a sua própria `representarV1`:

```ts
// fig03_01/servicios.ts — lo que hace cada ruta de la API del revisor.
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  buscarPorNombre, buscarRevision, buscarServicio, cambiarServicio, crearRevision, crearServicio,
  equipoDeRetirado, etiqueta, listarServicios, retirarServicio, terminarRevision,
  type Revision, type Servicio,
} from "./almacen.ts";
import type { Credencial } from "./autenticacion.ts";
import { revisarDestino } from "./destinos.ts";
import { coincideDebil, coincideFuerte, hayCoincidencia, interpretarLista } from "./etiquetas.ts";
import { revisar } from "./cliente.ts";
import { CuerpoDemasiadoGrande, enviarJson, enviarVacio, fallar, leerCuerpo, TOPE_CUERPO, type Cabeceras } from "./respuestas.ts";

export type Contexto = {
  peticion: IncomingMessage;
  respuesta: ServerResponse;
  parametros: string[];
  credencial: Credencial;
};

const ESPERA_EN_COLA_MS = 1000;

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
async function leerJson(peticion: IncomingMessage, respuesta: ServerResponse): Promise<Record<string, unknown> | undefined> {
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
```

Repare na ordem dentro de `darDeAlta` e de `cambiar`: primeiro `validar` (`422`), depois o destino (`422` também), e no final o nome repetido (`409`). As regras sobre os dados vêm antes da colisão com o estado: não vale a pena procurar se já existe um serviço com um nome que, de todo modo, não é válido.

#### 3.9.2 Os arquivos que não mudam

Os demais arquivos são os da Lição 2, sem uma única alteração. Seguem completos para que o `revisor` possa ser montado a partir desta lição. `etiquetas.ts` é o que faz a comparação forte que `cambiar` usa:

```ts
// fig03_01/etiquetas.ts — leer y comparar etiquetas (ETag) como pide el RFC 9110.
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
// fig03_01/respuestas.ts — las tres formas de responder del revisor y la lectura del cuerpo.
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
// fig03_01/autenticacion.ts — quién eres (la credencial) y qué puedes hacer (el rol).
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
// fig03_01/servidor.ts — la cara servidor del revisor: la API que administra los servicios observados.
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

```ts
// fig03_01/cliente.ts — la cara cliente del revisor: consulta un servicio y clasifica lo que respondió.
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
// fig03_01/destinos.ts — a dónde puede conectarse el revisor. Defensa contra SSRF.
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
// fig03_01/laboratorio.ts
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

```json fig03_01/package.json
{
  "type": "module"
}
```

#### 3.9.3 A execução completa

Abra dois terminais em `~/curso-http/fig03_01/`. No primeiro, o laboratório; no segundo, o `revisor`:

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

Em um terceiro terminal, estas são todas as requisições das seções 3.2 a 3.8, na ordem em que apareceram, com o que responderam. Estão juntas para que sejam comparadas de uma vez com as de quem acompanha; lembre que as tags vão terminar diferentes:

```text
$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 200 OK
ETag: "1-1-c4dd49c4"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ ETAG=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ETAG=$ETAG"
ETAG="1-1-c4dd49c4"

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-2-c4dd49c4"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/500","limite_ms":2000}'
HTTP/1.1 412 Precondition Failed
Content-Type: text/plain; charset=utf-8
Content-Length: 115
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu etiqueta ya no es la vigente: el servicio cambió o el revisor se reinició; vuelve a leerlo antes de cambiarlo

$ VIGENTE=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "VIGENTE=$VIGENTE"
VIGENTE="1-2-c4dd49c4"

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: W/$VIGENTE" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 412 Precondition Failed
Content-Type: text/plain; charset=utf-8
Content-Length: 109
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

If-Match se compara en fuerte: una etiqueta débil (W/) no sirve para cambiar; manda la ETag tal como llegó

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: \"9-9\", $VIGENTE" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-3-c4dd49c4"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: *' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-4-c4dd49c4"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ ETAG=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ETAG=$ETAG"
ETAG="1-4-c4dd49c4"

$ ( sleep 1; printf '%s' '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1000}' ) | curl -sS -w 'lenta: %{http_code}\n' -X PUT -T - http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" & LENTA=$!; sleep 0.3; curl -sS -o /dev/null -w 'rápida: %{http_code}\n' -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}'; wait $LENTA
rápida: 200
el servicio cambió mientras se atendía tu petición; vuelve a leerlo antes de cambiarlo
lenta: 412

$ curl -sS http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 428 Precondition Required
Content-Type: text/plain; charset=utf-8
Content-Length: 52
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

para cambiar un servicio manda If-Match con su ETag

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: text/plain; charset=utf-8
Content-Length: 50
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya existe un servicio llamado pagos: /servicios/2

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: *' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: text/plain; charset=utf-8
Content-Length: 50
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya existe un servicio llamado pagos: /servicios/2

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-b' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/4
ETag: "4-1-c4dd49c4"
Content-Type: application/json
Content-Length: 85
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"","url":"ftp://archivos","limite_ms":5}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 137
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

nombre: debe ser un texto de 1 a 40 caracteres
url: debe ser una dirección http o https
limite_ms: debe ser un entero entre 100 y 10000

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '["inventario"]'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 31
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo no es un objeto JSON

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":"2000"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 48
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

limite_ms: debe ser un entero entre 100 y 10000

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"metadatos","url":"http://169.254.169.254/latest/meta-data/"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 70
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: 169.254.169.254:80: dirección privada o reservada

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"yo-mismo","url":"http://localhost:18080/mantenimiento"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 75
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: localhost resuelve a una dirección privada o reservada

$ curl -i -X DELETE http://127.0.0.1:18080/servicios/2 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/2 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 410 Gone
Content-Type: text/plain; charset=utf-8
Content-Length: 42
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 2 se retiró y no va a volver

$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 25
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 99

$ curl -i http://127.0.0.1:18080/servicios/2 -H 'Authorization: Bearer escritura-b'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 2

$ curl -i -X PUT http://127.0.0.1:18080/servicios/2 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: *' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 410 Gone
Content-Type: text/plain; charset=utf-8
Content-Length: 42
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 2 se retiró y no va a volver

$ ID=$(curl -sS -o /dev/null -w '%header{location}' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"efimero","url":"http://127.0.0.1:18081/codigo/200"}'); ETAG=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a'); echo "ID=$ID ETAG=$ETAG"
ID=/servicios/5 ETAG="5-1-c4dd49c4"

$ ( sleep 1; printf '%s' '{"nombre":"efimero","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}' ) | curl -sS -w 'lento: %{http_code}\n' -X PUT -T - http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" & LENTO=$!; sleep 0.3; curl -sS -o /dev/null -w 'DELETE en el hueco: %{http_code}\n' -X DELETE http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a'; wait $LENTO
DELETE en el hueco: 204
el servicio 5 se retiró y no va a volver
lento: 410

$ curl -i http://127.0.0.1:18080/v1/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 200 OK
Deprecation: @1782864000
Sunset: Sun, 31 Jan 2027 00:00:00 GMT
Link: <https://revisor.example/docs/migrar-de-v1>; rel="deprecation"; type="text/html"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","direccion":"http://127.0.0.1:18081/codigo/200","limite":3}

$ curl -i http://127.0.0.1:18080/v1/servicios -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Deprecation: @1782864000
Sunset: Sun, 31 Jan 2027 00:00:00 GMT
Link: <https://revisor.example/docs/migrar-de-v1>; rel="deprecation"; type="text/html"
Content-Type: application/json
Content-Length: 104
Date: Wed, 21 Oct 2026 13:18:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","direccion":"http://127.0.0.1:18081/codigo/200","limite":3}]}

$ curl -i http://127.0.0.1:18080/v0/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 410 Gone
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

la versión 0 de la API se retiró el 31 de enero de 2026; usa /servicios

$ curl -i http://127.0.0.1:18080/v0/servicios
HTTP/1.1 410 Gone
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

la versión 0 de la API se retiró el 31 de enero de 2026; usa /servicios
```

Trinta e uma linhas. As vinte e quatro respostas completas, as de `curl -i`, deram `[200 200 412 412 200 200 428 409 409 201 422 400 422 422 422 204 410 404 404 410 200 200 410 410]`; a corrida de 3.3.4 deu `rápida: 200` e `lenta: 412`; a de 3.7.3, `DELETE en el hueco: 204` e `lento: 410`; e as cinco linhas que guardam uma tag (`ETAG` duas vezes, `VIGENTE`, e `ID` com `ETAG` em 3.7.3) ou leem o serviço sem `-i` não imprimem o código. Cada erro desta lição chegou **depois** de passar pelas sete perguntas do ponto de entrada da Lição 2: todas traziam rota, método, credencial e permissão corretos, e ainda assim não podiam ser cumpridas.

O terminal do `revisor` anotou cada requisição, na mesma ordem:

```text
revisor en http://127.0.0.1:18080
GET /servicios/1
GET /servicios/1
PUT /servicios/1
PUT /servicios/1
GET /servicios/1
PUT /servicios/1
PUT /servicios/1
PUT /servicios/1
GET /servicios/1
PUT /servicios/1
PUT /servicios/1
GET /servicios/1
PUT /servicios/1
POST /servicios
PUT /servicios/1
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
DELETE /servicios/2
GET /servicios/2
GET /servicios/99
GET /servicios/2
PUT /servicios/2
POST /servicios
GET /servicios/5
PUT /servicios/5
DELETE /servicios/5
GET /v1/servicios/1
GET /v1/servicios
GET /v0/servicios/1
GET /v0/servicios
```

## O erro a ser observado

### Os dois `200` que não deviam ter saído

As duas versões quebradas mais importantes desta lição já foram provocadas no corpo da lição, porque são o seu coração: o `PUT` que não pergunta (3.2.2) e o que pergunta uma única vez (3.3.4). As duas falham do mesmo jeito, e vale a pena dizer exatamente o que está errado na resposta, porque não se vê em nenhum cabeçalho: é um `200` que promete algo falso. Um `200` a um `PUT` diz ao cliente «a alteração foi aplicada sobre o que foi lido». Nos dois defeitos, o segundo `200` foi aplicado sobre algo que seu cliente nunca viu, e apagou uma alteração alheia. A correção também é a mesma nos dois casos, em duas partes: exigir e comparar a condição antes de ler o corpo (`428` e `412`), e voltar a comparar a versão no mesmo passo em que se escreve (`412` outra vez). Falta uma das duas, e volta a cena do começo.

### O `410` que denuncia

O segundo defeito é mais sutil, porque nasce de querer fazer as coisas direito. Alguém lê a seção 15.5.11, decide que todo serviço retirado merece seu `410`, e simplifica a condição de `encontrar` retirando a comparação da equipe (versão completa em `defectos/410-para-todos/servicios.ts`):

```ts
  if (servicio === undefined && equipo !== undefined) {
    fallar(respuesta, 410, `el servicio ${id} se retiró y no va a volver`);
```

**Série E:** crie `rota/` do zero (`rm -r rota && cp -R fig03_01 rota`), coloque essa versão em `rota/servicios.ts` e inicie o laboratório e o `revisor` a partir de `rota/`. A equipe a retira seu serviço 2, e a equipe b pergunta pelo 2 e pelo 99:

```text
$ curl -i -X DELETE http://127.0.0.1:18080/servicios/2 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:18:33 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/2 -H 'Authorization: Bearer escritura-b'
HTTP/1.1 410 Gone
Content-Type: text/plain; charset=utf-8
Content-Length: 42
Date: Wed, 21 Oct 2026 13:18:33 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 2 se retiró y no va a volver

$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-b'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 25
Date: Wed, 21 Oct 2026 13:18:33 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 99
```

A equipe b nunca teve acesso ao serviço 2, mas agora sabe que ele existiu e que já não existe; e sabe que o 99 nunca existiu. É a enumeração do quadro da Lição 2, por uma porta nova: duas respostas distintas para dois identificadores alheios. Com um script como o enumerador da Lição 2, a equipe b poderia percorrer os identificadores e saber quantos serviços cada equipe retirou. A correção é devolver à condição seu `delEquipo(equipo, credencial)`: o `410` é para quem podia ver o recurso quando ele existia, e para os demais, o mesmo `404` de sempre.

## O que se costuma fazer de errado

**`400` para tudo o que não pode ser cumprido.** O cliente não consegue distinguir «o JSON está quebrado» de «o nome está repetido» de «a alteração foi escrita sobre uma versão velha», e cada uma se corrige de um jeito. Se a API decide usar `400` também para a validação, como recomendam algumas diretrizes, que ao menos o conflito (`409`) e a pré-condição (`412`) tenham seu código.

**Um `PUT` sem condição em um recurso compartilhado.** É a atualização perdida esperando para acontecer. Não falha nos testes, porque os testes quase nunca têm dois editores ao mesmo tempo; falha em produção, em silêncio, com um `200` para cada um.

**Comparar a versão só no começo.** Se entre a comparação e a escrita há algo que espera (ler o corpo, consultar o DNS, chamar outro serviço), outra requisição com a mesma tag passa também, e a última a escrever sobrescreve a outra com `200`. A versão é comparada outra vez no mesmo passo em que se escreve, como um `UPDATE … WHERE version = N`.

**Comparar `If-Match` em modo fraco, ou como texto.** Em modo fraco, `W/"1-2-…"` passaria por boa, e a especificação o proíbe com um **deve**. Como texto, uma lista `"9-9", "1-2-…"` ou um `*` dariam `412` mesmo que a condição seja cumprida.

**`409` quando `If-Match` falha.** O cliente colocou uma condição em um cabeçalho e ela não foi cumprida: isso é um `412`. O `409` é para a colisão com o estado que o cliente não expressou como condição, ou para quando a versão viaja dentro do corpo.

**`412` quando falta `If-Match`.** Sem condição, não há nada que tenha falhado. O cliente que recebe `412` acredita que alguém mudou o recurso e relê procurando a alteração alheia; com `428` sabe que só lhe faltou enviar a tag.

**Um `409` que não diz com o que colide.** A seção 15.5.10 pede que o corpo permita reconhecer a origem do conflito. «Conflito» a seco deixa o cliente adivinhando que campo mudar.

**Enviar só a primeira falha de validação.** Três viagens para corrigir três campos, quando um `422` com a lista completa resolvia em uma.

**`410` para todos, ou `404` para sempre.** O primeiro denuncia o que existiu a quem não podia vê-lo; o segundo faz o dono de um recurso retirado de propósito procurar um erro de endereço.

**Retirar uma versão sem avisar, ou com os avisos ao contrário.** Um `410` sem meses prévios de `Deprecation` e `Sunset` é descoberto em produção. E um `Sunset` anterior à `Deprecation` viola a seção 4 do RFC 9745 e não dá a ninguém tempo de migrar.

**Apresentar `Deprecation` ou `Sunset` como obrigações.** São avisos que o cliente pode ler; o recurso descontinuado se comporta igual a antes, e a data de `Sunset` é uma pista. Um cliente bem feito os registra e alerta quem o mantém; não deixa de funcionar por vê-los.

## Exercícios

Os quatro se corrigem sozinhos: cada um termina com uma execução que diz se a previsão estava certa. Escreva a previsão no [diário de bordo](bitacora.md) **antes** de rodar qualquer coisa. Formam a **série F**: para todos é preciso o laboratório e o `revisor` de 3.9 rodando, recém-iniciados, e os quatro são executados em ordem, um depois do outro, sem reiniciar entre eles, exceto onde o exercício pedir.

### Exercício 1 — Conflito, regra ou pré-condição?

Sem rodar nada, preveja o código de cada uma destas nove requisições e, para cada erro, diga se é um conflito de estado, uma regra de negócio, uma pré-condição, ou algo que o ponto de entrada da Lição 2 ou a seção 3.7 já resolvia. O nome da segunda tem 41 letras x:

```bash
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200"}'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx","url":"http://127.0.0.1:18081/codigo/200"}'
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: "1-1-00000000"' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200"}'
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -d 'catalogo'
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -H 'If-Match: "1-0-0"' -d 'catalogo'
curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-a'
curl -i http://127.0.0.1:18080/v0/servicios
curl -i -X DELETE http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b'
curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-a'
```

A quarta e a quinta têm pegadinha: cada uma traz dois problemas. Qual é perguntado primeiro?

### Exercício 2 — A tag que não sobreviveu à reinicialização

Guarde a tag do serviço 1 em uma variável, **pare o `revisor` e inicie-o de novo** (`Ctrl`+`C` e `node servidor.ts`), e envie uma alteração com a tag de antes:

```bash
ANTES=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ANTES=$ANTES"
# aquí detienes y vuelves a arrancar el revisor
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ANTES" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
```

Preveja o código. Depois responda a duas perguntas. Ninguém alterou o serviço 1 entre a leitura e a escrita: por que é correto que o `revisor` se recuse? E o que teria de ruim um corpo que dissesse apenas «alguém mudou o serviço»?

### Exercício 3 — Duas falhas em uma requisição

Sem reiniciar, guarde a tag vigente do serviço 1 em `AHORA` e envie duas alterações com o mesmo corpo inválido: uma com uma tag inventada e outra com a vigente. No final, leia a tag outra vez:

```bash
AHORA=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "AHORA=$AHORA"
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: "1-7-00000000"' -d '{"nombre":"","url":"ftp://archivos"}'
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $AHORA" -d '{"nombre":"","url":"ftp://archivos"}'
curl -sS -o /dev/null -w '%header{etag}\n' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
```

Preveja os dois códigos e se a tag do final é igual a `AHORA`. Por que o primeiro não menciona o nome vazio?

### Exercício 4 — Leia os avisos com um programa

Escreva um programa, `fig03_03.ts`, que peça uma rota do `revisor` com `lectura-a` e diga: desde quando está descontinuada, quando deixa de responder, onde ler mais, e se as duas datas estão na ordem que a seção 4 do RFC 9745 exige. Se a rota não traz avisos, que o diga. Teste-o com `/v1/servicios` e com `/servicios`. Dica: o valor de `Deprecation` é `@` seguido de segundos, e o `new Date(texto)` do JavaScript entende o formato de `Sunset`.

## Soluções

### Solução 1

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: text/plain; charset=utf-8
Content-Length: 53
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya existe un servicio llamado catalogo: /servicios/1

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 47
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

nombre: debe ser un texto de 1 a 40 caracteres

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: "1-1-00000000"' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 412 Precondition Failed
Content-Type: text/plain; charset=utf-8
Content-Length: 115
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu etiqueta ya no es la vigente: el servicio cambió o el revisor se reinició; vuelve a leerlo antes de cambiarlo

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -d 'catalogo'
HTTP/1.1 415 Unsupported Media Type
Accept: application/json
Content-Type: text/plain; charset=utf-8
Content-Length: 51
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo debe ser application/json, no text/plain

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -H 'If-Match: "1-0-0"' -d 'catalogo'
HTTP/1.1 415 Unsupported Media Type
Accept: application/json
Content-Type: text/plain; charset=utf-8
Content-Length: 51
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo debe ser application/json, no text/plain

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 3

$ curl -i http://127.0.0.1:18080/v0/servicios
HTTP/1.1 410 Gone
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

la versión 0 de la API se retiró el 31 de enero de 2026; usa /servicios

$ curl -i -X DELETE http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 3
```

Em ordem:

1. **`409`, conflito de estado.** `catalogo` é um nome válido; já existe um na equipe a.
2. **`422`, regra de negócio.** O nome tem 41 caracteres; a regra diz de 1 a 40. Nenhum estado do servidor o tornaria válido.
3. **`412`, pré-condição.** A condição não coincide com a tag vigente (`"1-1-00000000"` não é a de quem executa; a de quem executa termina com os oito dígitos desta inicialização).
4. **`415`, não `428`.** Faltam duas coisas, o formato e a condição. O formato se conhece por um cabeçalho, `Content-Type`, sem processar o corpo, e a seção 13.2.1 pede que o que se detecta antes de processar o conteúdo vença as pré-condições. Se o cliente corrigir o `Content-Type`, a resposta seguinte será `428`.
5. **`415`, não `412`.** Agora a condição vem, e além disso está velha (`"1-0-0"` não é nenhuma versão do serviço). Não importa: o formato errado se sabe primeiro, e com ele o `revisor` nem sequer avalia `If-Match`. Se o cliente corrigir o `Content-Type`, a resposta seguinte será `412`.
6. **`404`, o ponto de entrada da Lição 2.** O serviço 3 é da equipe b; para a equipe a ele não existe.
7. **`410`, versão retirada.** Sem credencial: a `/v0` é atendida antes de perguntar quem pede.
8. **`204`.** A equipe b retira seu serviço 3.
9. **`404`, não `410`.** O serviço 3 foi retirado, mas era da equipe b. Para a equipe a nunca existiu, e continua sem existir: o `410` é só para o dono.

### Solução 2

```text
$ ANTES=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ANTES=$ANTES"
ANTES="1-1-caba5fd2"

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ANTES" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 412 Precondition Failed
Content-Type: text/plain; charset=utf-8
Content-Length: 115
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu etiqueta ya no es la vigente: el servicio cambió o el revisor se reinició; vuelve a leerlo antes de cambiarlo
```

`412`, e é correto: a tag que o cliente envia não é a vigente. Depois da reinicialização, o serviço 1 tem a tag `"1-1-…"` com outros oito dígitos, porque o `revisor` sorteia um identificador novo a cada inicialização. A especificação não pede ao servidor que saiba **por que** a tag não coincide; pede que não execute o método se não coincide. E a ação que o código indica ao cliente, reler e refazer sua alteração sobre o que encontrar, é a correta: o `revisor` que atendeu sua leitura já não existe, e o que o cliente acreditava saber dele também não. Em um servidor com banco de dados, o serviço teria sobrevivido à reinicialização, mas neste, que guarda tudo em memória, nada garante que o serviço 1 de agora seja o mesmo de antes.

Um corpo que dissesse apenas «alguém mudou o serviço» seria **falso** neste caso: ninguém mexeu nele. Por isso o `revisor` diz as duas causas possíveis, «o serviço mudou ou o revisor reiniciou», e a ação, «leia-o de novo antes de alterá-lo». O código decide o que fazer; o corpo, se uma pessoa o lê, não a manda procurar uma alteração que não existe. Para comprovar que a tag nova funciona, basta lê-la e usá-la: é a primeira coisa que o exercício 3 faz.

### Solução 3

```text
$ AHORA=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "AHORA=$AHORA"
AHORA="1-1-e35ad556"

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: "1-7-00000000"' -d '{"nombre":"","url":"ftp://archivos"}'
HTTP/1.1 412 Precondition Failed
Content-Type: text/plain; charset=utf-8
Content-Length: 115
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu etiqueta ya no es la vigente: el servicio cambió o el revisor se reinició; vuelve a leerlo antes de cambiarlo

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $AHORA" -d '{"nombre":"","url":"ftp://archivos"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 89
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

nombre: debe ser un texto de 1 a 40 caracteres
url: debe ser una dirección http o https

$ curl -sS -o /dev/null -w '%header{etag}\n' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
"1-1-e35ad556"
```

O primeiro é **`412`**: a condição é avaliada antes de ler o corpo (seção 13.2.1), e como não é cumprida, o corpo nem é verificado. Por isso não menciona o nome vazio: dizer ao cliente que o nome está errado de nada serve se o que ele precisa fazer primeiro é reler; quando reler, talvez o serviço já tenha outro nome e sua alteração inteira seja outra. O segundo é **`422`**: a condição é cumprida, o corpo é lido, e as duas falhas aparecem juntas, como pede a política de 3.6.1. E a tag do final **é igual a `AHORA`**: nenhum dos dois `PUT` mudou nada, então a versão não subiu. Uma alteração rejeitada não gasta a tag; o cliente pode corrigir seus dados e enviá-la de novo.

### Solução 4

```ts
// fig03_03.ts
// Lee los avisos de retiro de una ruta: Deprecation (RFC 9745) y Sunset (RFC 8594).
// Uso: node fig03_03.ts /v1/servicios
const ruta = process.argv[2] ?? "/v1/servicios";
const respuesta = await fetch(`http://127.0.0.1:18080${ruta}`, {
  headers: { Authorization: "Bearer lectura-a" },
});
await respuesta.body?.cancel();

const desaprobacion = respuesta.headers.get("deprecation"); // "@segundos": fecha de campo estructurado
const retiro = respuesta.headers.get("sunset"); // fecha HTTP: "Sun, 31 Jan 2027 00:00:00 GMT"
console.log(`${ruta}: ${respuesta.status}`);

if (desaprobacion === null && retiro === null) {
  console.log("sin avisos: la ruta no anuncia que se vaya a retirar");
} else {
  let desde: Date | undefined;
  if (desaprobacion !== null) {
    const segundos = /^@(-?\d+)$/.exec(desaprobacion);
    if (segundos === null) console.log(`Deprecation no es una fecha válida: ${desaprobacion}`);
    else desde = new Date(Number(segundos[1]) * 1000);
  }
  let hasta: Date | undefined;
  if (retiro !== null) {
    hasta = new Date(retiro);
    if (Number.isNaN(hasta.getTime())) {
      console.log(`Sunset no es una fecha válida: ${retiro}`);
      hasta = undefined;
    }
  }
  console.log(`desaprobada desde: ${desde?.toISOString() ?? "(no lo dice)"}`);
  console.log(`deja de responder: ${hasta?.toISOString() ?? "(no lo dice)"}`);
  const enlace = respuesta.headers.get("link");
  if (enlace !== null) console.log(`dónde leer más:   ${enlace}`);
  if (desde !== undefined && hasta !== undefined) {
    // RFC 9745, sección 4: la fecha de Sunset no puede ser anterior a la de Deprecation.
    console.log(hasta.getTime() >= desde.getTime() ? "orden correcto: primero se desaprueba, luego se retira" : "AVISO MAL ARMADO: el retiro es anterior a la desaprobación");
  }
}
```

```text
$ node fig03_03.ts /v1/servicios
/v1/servicios: 200
desaprobada desde: 2026-07-01T00:00:00.000Z
deja de responder: 2027-01-31T00:00:00.000Z
dónde leer más:   <https://revisor.example/docs/migrar-de-v1>; rel="deprecation"; type="text/html"
orden correcto: primero se desaprueba, luego se retira

$ node fig03_03.ts /servicios
/servicios: 200
sin avisos: la ruta no anuncia que se vaya a retirar
```

`await respuesta.body?.cancel()` descarta o corpo sem lê-lo, porque o programa só precisa dos cabeçalhos. A expressão regular `^@(-?\d+)$` aceita exatamente a forma de data dos campos estruturados; qualquer outra coisa é reportada como inválida, em vez de se converter em uma data qualquer. Com `Sunset` acontece o mesmo, por uma razão mais sutil: `new Date("proximo-mes")` não lança nenhum erro, produz uma data inválida, e é `toISOString()` quem depois lança `RangeError: Invalid time value` e derruba o programa. Por isso o programa pergunta `Number.isNaN(hasta.getTime())` antes de usá-la. Testado contra um servidor de brinquedo que respondia `Sunset: proximo-mes`, o programa não cai: imprime `Sunset no es una fecha válida: proximo-mes`, depois `desaprobada desde: 2026-07-01T00:00:00.000Z` e `deja de responder: (no lo dice)`, e termina com código 0. E a comparação final é a regra da seção 4 do RFC 9745: se algum dia a configuração da `/v1` puser um `Sunset` anterior à `Deprecation`, o programa o diz em vez de se calar. Um cliente real faria com isso algo mais útil do que imprimir: registrá-lo em seu log e avisar quem o mantém, uma vez, e não a cada requisição.

## Critérios de sucesso

- [ ] Dá para dizer, para uma requisição que falha, se é conflito de estado, regra de negócio ou pré-condição, e responder `409`, `422` ou `412` com a pergunta que a decide.
- [ ] `node fig03_02.ts` contra o `revisor` de 3.9 termina com «el cambio de Ana sigue ahí», e contra `rota/` sem a condição, com «SE PERDIÓ el cambio de Ana».
- [ ] A corrida de 3.3.4 dá `rápida: 200` e `lenta: 412` e deixa `"limite_ms":3000` contra o `revisor` de 3.9, e `200` e `200` com `"limite_ms":1000` contra a cópia que passa `null` a `cambiarServicio`.
- [ ] Um `PUT` a `/servicios/1` sem `If-Match` dá `428` com um corpo que diz que cabeçalho enviar; com uma tag velha dá `412`; com `W/` na frente da vigente dá `412` com o aviso de que é fraca; com uma lista que a contém, ou com `*`, dá `200` e uma `ETag` nova.
- [ ] Um `PUT` com `Content-Type: text/plain` dá `415`, com uma tag velha ou sem nenhuma.
- [ ] Um cadastro de `pagos` com `escritura-a` dá `409` e diz com que serviço colide; a mesma requisição com `escritura-b` dá `201`.
- [ ] Um cadastro com `{"nombre":"","url":"ftp://archivos","limite_ms":5}` dá `422` com três linhas, e um com `["inventario"]` dá `400`.
- [ ] Depois de retirar o serviço 2, a equipe a recebe `410` e a equipe b recebe `404`, com o mesmo corpo do de um serviço que nunca existiu.
- [ ] `/v1/servicios/1` traz `Deprecation`, `Sunset` e `Link`, e `node fig03_03.ts /v1/servicios` diz que a ordem está correta; `/v0/servicios` dá `410` sem credencial.
- [ ] Ao terminar, não resta nenhum programa escutando: `curl -i http://127.0.0.1:18080/` dá o erro 7.

## Resumo

Responda sem olhar a lição:

1. Que pergunta decide entre `409`, `412` e `422`? Dê um exemplo do `revisor` para cada um.
2. O que é a atualização perdida, e em qual dos quatro passos ela ocorre?
3. Se o `revisor` já comparou `If-Match` no começo, por que volta a comparar a versão ao escrever? Qual é o equivalente em um banco de dados?
4. Por que `If-Match` é comparado em modo forte, e o que o `revisor` responde a uma tag `W/` que em modo fraco coincidiria?
5. O que um cliente precisa fazer depois de um `412`, e o que depois de um `428`? Por que não é a mesma coisa?
6. Por que a condição é avaliada antes de ler o corpo? Que seção do RFC 9110 o diz?
7. Quando uma atualização perdida é respondida com `409` e não com `412`?
8. Qual é a política do curso para `400` versus `422`, e o que decidem outras diretrizes?
9. O que um `410` diz que um `404` não diz? Por que o `revisor` não o diz a todos?
10. Que data dá `Deprecation`, qual dá `Sunset`, que peso tem cada RFC, e que regra relaciona as duas datas?

## Fontes

Todas foram consultadas em 21 de outubro de 2026.

1. [RFC 9110, *HTTP Semantics*, seção 15.5.10](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.10): o `409`, o conflito com o estado atual que o usuário pode resolver, o conteúdo que permite reconhecer sua origem e o exemplo de versões em um `PUT`.
2. [RFC 9110, seção 15.5.11](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.11): o `410`, a condição provavelmente permanente, a retirada intencional, o cache por heurística e a liberdade de não marcá-lo para sempre.
3. [RFC 9110, seção 15.5.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.5): o `404` não diz se a ausência é temporária ou permanente, e prefere-se o `410` quando o servidor sabe que é permanente.
4. [RFC 9110, seção 15.5.13](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.13): o `412`, uma condição dos cabeçalhos que resultou falsa.
5. [RFC 9110, seção 13.1.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1): `If-Match`, sua forma (`*` ou uma lista), a comparação forte obrigatória, os três passos de avaliação e a atualização perdida (*lost update*).
6. [RFC 9110, seções 13.2.1 e 13.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.1): quando as pré-condições são avaliadas (antes de processar o conteúdo, depois das verificações normais) e em que ordem.
7. [RFC 9110, seção 8.8.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.2): a comparação forte e a fraca de tags, com sua tabela.
8. [RFC 9110, seção 15.5.21](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.21): o `422`, conteúdo que se entende e tem sintaxe correta mas não pode ser processado; e a [seção 9.3.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.4), `PUT` como substituição do estado completo.
9. [RFC 6585, *Additional HTTP Status Codes*, seção 3](https://www.rfc-editor.org/rfc/rfc6585.html#section-3): o `428`, a requisição condicional exigida contra a atualização perdida, a explicação de como reenviá-la e a proibição de armazená-lo em cache.
10. [RFC 9745, *The Deprecation HTTP Response Header Field*](https://www.rfc-editor.org/rfc/rfc9745.html) (março de 2025, padrão proposto): a data de descontinuação como data de campo estruturado (2.1), seu alcance (2.2), a relação `deprecation` para `Link` (3), a regra de que `Sunset` não seja anterior (4) e que descontinuar não muda o comportamento (5).
11. [RFC 8594, *The Sunset HTTP Header Field*](https://www.rfc-editor.org/rfc/rfc8594.html) (maio de 2019, informativo): a data em que o recurso provavelmente deixará de responder, como pista (3), e as duas etapas da descontinuação (1.4); sua [ficha no datatracker da IETF](https://datatracker.ietf.org/doc/rfc8594/), que a mostra como proposta individual.
12. [RFC 9457, *Problem Details for HTTP APIs*, seção 3](https://www.rfc-editor.org/rfc/rfc9457.html#section-3): o exemplo com a extensão `errors` e um `pointer` por campo, que a Lição 5 adota para o `422`.
13. [Registro de códigos de status HTTP da IANA](https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml): os nomes oficiais dos cinco códigos, entre eles `422 Unprocessable Content` e `428 Precondition Required`.
14. [*Zalando RESTful API Guidelines*](https://opensource.zalando.com/restful-api-guidelines/): `400` também para a validação de negócio e `422` como «não usar»; `412` para a concorrência otimista com `If-Match` e `428` para exigi-la.
15. [Google, AIP-154 *Resource freshness validation*](https://google.aip.dev/154) e [`google.rpc.Code`](https://github.com/googleapis/googleapis/blob/master/google/rpc/code.proto): a tag como campo do recurso, `ABORTED` (`409`) quando não coincide e `INVALID_ARGUMENT` (`400`) para os argumentos inválidos; e a [documentação da API REST do GitHub](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api), que responde `422` à validação e aos valores repetidos (`already_exists`).

### Termos desta lição

| | |
|---|---|
| **atualização perdida** (*lost update*) | quando um cliente salva sua cópia velha de um recurso e apaga, sem saber, a alteração que outro fez depois de ele ter lido |
| **concorrência otimista** | deixar todos lerem e editarem sem bloquear, e rejeitar apenas a escrita que chega sobre uma versão velha |
| **conflito de estado** | uma requisição válida que colide com o que já existe no servidor; em outro estado funcionaria tal qual (`409`) |
| **descontinuado** (*deprecated*) | que já não se recomenda usar, embora ainda funcione |
| **pré-condição** | uma condição que o cliente coloca em um cabeçalho (`If-Match`) para que o método só seja executado se for cumprida (`412` se não) |
| **regra de negócio** | uma condição sobre os valores dos dados, que não depende do estado do servidor (`422` se não for cumprida) |
| **retirada** (*sunset*) | o momento em que um recurso ou uma versão deixa de responder |

---

**Anterior:** [Lição 2 — O cliente errou (I): 400, 401, 403, 404, 405 e 415](02-errores-del-cliente-peticion.md) · **Próxima:** [Lição 4 — Capacidade e falhas do servidor: 429, 500, 502, 503 e 504](04-capacidad-y-fallas-del-servidor.md)

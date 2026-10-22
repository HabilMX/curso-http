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

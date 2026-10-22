// fig07_01/por-type.ts — el mismo código, dos decisiones: lo que agrega el type de un Problem Details.
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

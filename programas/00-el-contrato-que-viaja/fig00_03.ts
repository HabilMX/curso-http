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

// fig08_07.ts — ¿qué pasa si el cliente se conecta a la dirección IP y no al nombre? Resuelve el nombre una vez,
// arma la URL con la dirección en lugar del nombre y pide la página. Es la contraprueba de la sección 8.12.4
// (necesita internet): lo contrario de lo que hace consultar() en cliente.ts, que conserva el nombre en la URL.
// Uso: node fig08_07.ts <nombre>      (por ejemplo, node fig08_07.ts expired.badssl.com)
import { lookup } from "node:dns/promises";
import { get } from "node:https";

const nombre = process.argv[2];
if (nombre === undefined) {
  console.error("uso: node fig08_07.ts <nombre>");
  process.exit(2);
}
const { address } = await lookup(nombre, { family: 4 });
get(`https://${address}/`, { timeout: 8000 }, (respuesta) => {
  console.log(JSON.stringify({ nombre, codigo: respuesta.statusCode }));
  respuesta.destroy();
}).on("error", (error: NodeJS.ErrnoException) => {
  console.log(JSON.stringify({ nombre, error: error.code }));
});

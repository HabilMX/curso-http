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

// fig08_02.ts — ¿el documento cuenta todo lo que el servidor puede decir? Cruza el catálogo de tipos de
// problema (problemas.ts) con openapi.json. No necesita ningún servidor: solo lee dos archivos.
// Uso: node fig08_02.ts          (desde la carpeta que contiene fig08_01/)
import { readFileSync } from "node:fs";
import { CATALOGO } from "./fig08_01/problemas.ts";

type Documento = { paths: Record<string, Record<string, { responses?: Record<string, unknown> }>> };

const texto = readFileSync(new URL("./fig08_01/openapi.json", import.meta.url), "utf8");
const documento = JSON.parse(texto) as Documento;

// Todos los códigos que alguna operación del documento declara.
const documentados = new Set<string>();
for (const ruta of Object.values(documento.paths)) {
  for (const operacion of Object.values(ruta)) {
    for (const codigo of Object.keys(operacion.responses ?? {})) documentados.add(codigo);
  }
}

console.log("clave                     código  type                  ¿código en el documento?  ¿type en el documento?");
let huecos = 0;
for (const [clave, { type, status }] of Object.entries(CATALOGO)) {
  // Con about:blank no hay nombre propio que buscar: el type es el mismo para todos esos errores.
  const nombre = type === "about:blank" ? null : type.split("/").at(-1) ?? "";
  const codigoDocumentado = documentados.has(String(status));
  const typeDocumentado = nombre === null ? null : texto.includes(nombre);
  if (!codigoDocumentado || typeDocumentado === false) huecos++;
  console.log(
    `${clave.padEnd(25)} ${String(status).padEnd(7)} ${(nombre ?? "about:blank").padEnd(21)} ` +
      `${(codigoDocumentado ? "sí" : "NO").padEnd(25)} ${typeDocumentado === null ? "(no aplica)" : typeDocumentado ? "sí" : "NO"}`,
  );
}
console.log();
console.log(`${Object.keys(CATALOGO).length} tipos en el catálogo; ${huecos} con un hueco en el documento`);
process.exitCode = huecos === 0 ? 0 : 1;

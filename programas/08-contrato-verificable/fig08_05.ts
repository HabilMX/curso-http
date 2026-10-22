// fig08_05.ts — ¿cuántas veces falla, y por qué, una comprobación que «a veces» falla? Repite 400 veces el cuerpo
// de 20000 bytes por partes de la matriz (el que el revisor rechaza con 413) y cuenta qué pasó cada vez.
// Necesita el revisor escuchando en el 18080: arráncalo con «node servidor.ts» desde fig08_01/.
// Uso: node fig08_05.ts [intentos] [pedazos]        (por omisión, 400 intentos de 20 pedazos de 1000 bytes)
// Con más pedazos se mide el límite de un cierre: el defecto drenar-antes tiraba hasta 1 MiB (1048576 bytes) antes de responder y por encima perdía el 413; el revisor de la lección responde de inmediato y cierra por etapas (ver respuestas.ts).
const R = "http://127.0.0.1:18080";
const INTENTOS = Number(process.argv[2] ?? 400);
const PEDAZOS = Number(process.argv[3] ?? 20);

const resultados = new Map<string, number>();
function contar(clave: string): void {
  resultados.set(clave, (resultados.get(clave) ?? 0) + 1);
}

for (let i = 0; i < INTENTOS; i++) {
  // El cuerpo se entrega en PEDAZOS pedazos de 1000 bytes (20 por omisión): no hay Content-Length, el revisor cuenta mientras lee.
  const porPartes = new ReadableStream<Uint8Array>({
    start(control) {
      for (let j = 0; j < PEDAZOS; j++) control.enqueue(new TextEncoder().encode("a".repeat(1000)));
      control.close();
    },
  });
  try {
    const respuesta = await fetch(R + "/servicios", {
      method: "POST",
      headers: { Authorization: "Bearer escritura-a", "Content-Type": "application/json" },
      body: porPartes,
      duplex: "half",
    } as RequestInit);
    await respuesta.text();
    contar(`respuesta ${respuesta.status}`);
  } catch (error) {
    // fetch rechaza con TypeError «fetch failed»; el motivo de verdad está en error.cause.code.
    contar(`sin respuesta: ${(error as { cause?: { code?: string } }).cause?.code ?? String(error)}`);
  }
}

for (const [clave, veces] of [...resultados].sort()) console.log(`${String(veces).padStart(5)}  ${clave}`);
console.log(`${INTENTOS} intentos`);

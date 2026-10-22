// fig02_02.ts
// El enumerador: prueba identificadores uno tras otro y agrupa los que recibieron la misma respuesta.
// Uso: node fig02_02.ts <credencial>
const credencial = process.argv[2] ?? "lectura-a";
const grupos = new Map<string, number[]>(); // respuesta → identificadores que la recibieron

for (let id = 1; id <= 6; id++) {
  const respuesta = await fetch(`http://127.0.0.1:18080/servicios/${id}`, {
    headers: { Authorization: `Bearer ${credencial}` },
  });
  const cuerpo = (await respuesta.text()).trim();
  // Un éxito trae los datos del servicio; un error trae un texto, y en él se borra el número pedido,
  // para que dos errores que solo difieren en el id cuenten como la misma respuesta.
  const huella = respuesta.ok
    ? `${respuesta.status} con datos`
    : `${respuesta.status} ${cuerpo.replaceAll(String(id), "N")}`;
  console.log(`servicio ${id}: ${respuesta.status} ${cuerpo}`);
  grupos.set(huella, [...(grupos.get(huella) ?? []), id]);
}

console.log(`\nrespuestas distintas: ${grupos.size}`);
for (const [huella, ids] of grupos) console.log(`  ${ids.join(", ").padEnd(18)} → ${huella}`);
if (grupos.size > 2) console.log("más de dos respuestas: lo que no es tuyo ya no se ve todo igual");

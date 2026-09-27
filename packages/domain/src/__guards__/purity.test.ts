import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../', import.meta.url));

function archivosTypeScript(dir: string): string[] {
  return readdirSync(dir).flatMap((entrada) => {
    const ruta = `${dir}/${entrada}`;
    if (statSync(ruta).isDirectory()) return archivosTypeScript(ruta);
    return entrada.endsWith('.ts') && !entrada.endsWith('.test.ts') ? [ruta] : [];
  });
}

const TODOS = archivosTypeScript(SRC)
  .filter((ruta) => !ruta.includes('__guards__'))
  .map((ruta) => ({ ruta: ruta.replace(SRC, 'src/'), codigo: readFileSync(ruta, 'utf8') }));

/** El veto de coma flotante aplica al camino del dinero; las fechas usan enteros. */
const CAMINO_DINERO = archivosTypeScript(`${SRC}money`)
  .concat([`${SRC}numeric.ts`])
  .map((ruta) => ({ ruta: ruta.replace(SRC, 'src/'), codigo: readFileSync(ruta, 'utf8') }));

const PROHIBIDOS_DINERO: Array<[RegExp, string]> = [
  [/\bparseFloat\s*\(/, 'parseFloat'],
  [/\bparseInt\s*\(/, 'parseInt'],
  [/\bNumber\s*\(/, 'Number('],
  [/\.toFixed\s*\(/, 'toFixed('],
  [/\.toNumber\s*\(/, 'toNumber()'],
];

describe('ADR-0011 — el camino del dinero no toca coma flotante', () => {
  it.each(CAMINO_DINERO.map((f) => [f.ruta, f.codigo] as const))(
    '%s no usa aritmética de coma flotante',
    (_ruta, codigo) => {
      for (const [patron, nombre] of PROHIBIDOS_DINERO) {
        expect(codigo, `prohibido ${nombre} en el dominio`).not.toMatch(patron);
      }
    },
  );
});

const PROHIBIDOS_FECHA = [
  /\.getFullYear\s*\(/,
  /\.getMonth\s*\(/,
  /\.getDate\s*\(/,
  /\.getHours\s*\(/,
  /\.toLocaleDateString\s*\(/,
  /\.toLocaleString\s*\(/,
  /['"]\d{4}-\d{2}-\d{2}['"]\s*\+/,
];

describe('ADR-0010 — ninguna fecha usa la zona del proceso', () => {
  it.each(TODOS.map((f) => [f.ruta, f.codigo] as const))(
    '%s no usa los getters zonales de Date',
    (_ruta, codigo) => {
      for (const patron of PROHIBIDOS_FECHA) {
        expect(codigo, `prohibido ${patron} (usa la zona del proceso)`).not.toMatch(patron);
      }
    },
  );
});

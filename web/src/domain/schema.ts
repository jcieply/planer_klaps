/* Walidacja plików projektu (Zod, wersja „mini”). Ładowana dopiero przy wczytywaniu pliku. */
import * as z from 'zod/v4-mini';

/** minimalny kształt pliku projektu (szczegóły uzupełnia Core.normalize); Zod w wersji „mini” – kilka razy mniejszej */
export const ProjectFileSchema = z.looseObject({
  meta: z.optional(z.looseObject({ title: z.optional(z.string()) })),
  scenes: z.array(z.looseObject({ id: z.optional(z.string()), num: z.optional(z.union([z.string(), z.number()])) })),
  days: z.optional(z.array(z.looseObject({ id: z.optional(z.string()), kind: z.optional(z.string()), sceneIds: z.optional(z.array(z.string())) }))),
  cast: z.optional(z.array(z.looseObject({ id: z.number(), name: z.string() }))),
  crew: z.optional(z.array(z.looseObject({}))),
  shots: z.optional(z.array(z.looseObject({}))),
});

export const EncryptedFileSchema = z.object({ klaps: z.literal('encrypted-project'), v: z.number(), plan: z.string().check(z.startsWith('KLAPS-E2E1:')), script: z.string(), media: z.string() });

/** czytelny komunikat z błędu walidacji */
export function describeZod(e: { issues: { path: PropertyKey[]; code?: string; expected?: unknown; message?: string }[] }): string {
  const what = (i: { code?: string; expected?: unknown; message?: string }) => (i.code === 'invalid_type' ? 'oczekiwano: ' + String(i.expected) : i.message || i.code || 'błąd');
  return e.issues.slice(0, 3).map((i) => `${i.path.map(String).join('.') || '(plik)'}: ${what(i)}`).join('; ');
}

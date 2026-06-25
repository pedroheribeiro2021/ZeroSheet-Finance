export function normalizeCategory(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD') // remove acento
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' '); // colapsa espa\u00e7os internos duplicados
}

export function normalizeCategory(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD') // remove acento
    .replace(/[\u0300-\u036f]/g, '');
}

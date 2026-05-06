export function normalizeCategory(category: string): string {
  return category
    ?.trim()
    .toLowerCase()
    .normalize('NFD') // remove acento
    .replace(/[\u0300-\u036f]/g, '');
}

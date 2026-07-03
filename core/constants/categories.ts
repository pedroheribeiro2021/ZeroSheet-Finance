/**
 * Categorias padrão por tipo de lançamento.
 * O usuário sempre pode digitar uma categoria própria ("Outra...").
 */

export const EXPENSE_CATEGORIES = [
  'Mercado',
  'Gasolina',
  'Internet',
  'Energia',
  'Água',
  'Telefone',
  'Assinaturas', // Amazon, Claude, Netflix, Spotify etc.
  'Academia',
  'Saúde',
  'Lazer',
  'Transporte',
  'Educação',
  'Moradia',
];

export const INCOME_CATEGORIES = [
  'Salário',
  'Freelance/Extras',
  'Reembolso',
  'Rendimentos',
];

export const RESERVE_CATEGORIES = ['Reserva financeira', 'Investimentos'];

/** @deprecated use EXPENSE_CATEGORIES — mantido por compatibilidade. */
export const DEFAULT_CATEGORIES = EXPENSE_CATEGORIES;

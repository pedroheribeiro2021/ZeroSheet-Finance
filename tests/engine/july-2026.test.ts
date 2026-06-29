/**
 * Contrato de julho/2026.
 *
 * Monta o dataset real do mês e fixa os números que calculateSummary deve
 * produzir. Se qualquer assert quebrar, o engine mudou de forma incompatível
 * com a planilha de referência.
 *
 * NÃO altere os valores assertados sem decisão explícita — eles são o
 * "orçamento acordado" de julho.
 */

import { describe, it, expect } from 'vitest';
import { calculateSummary } from '@/core/engine/calculations';
import { getWeeksInCycle } from '@/core/engine/weekly';
import { Transaction, Week } from '@/core/types/finance';

// IDs fictícios — representam os cartões Nubank e C6 deste usuário.
const NUBANK_ID = 'card-nubank-julho-2026';
const C6_ID = 'card-c6-julho-2026';

// ---------------------------------------------------------------------------
// Receitas
// ---------------------------------------------------------------------------
const receitas: Transaction[] = [
  {
    id: 'r1',
    monthId: 'julho-2026',
    type: 'income',
    category: 'Rendimento',
    amount: 5120,
    isFixed: false,
    isProvision: false,
    isRecurring: true,
    card: null,
    createdAt: '2026-07-01',
  },
  {
    id: 'r2',
    monthId: 'julho-2026',
    type: 'income',
    category: 'Split',
    amount: 100,
    isFixed: false,
    isProvision: false,
    isRecurring: false,
    card: null,
    createdAt: '2026-07-01',
  },
  {
    id: 'r3',
    monthId: 'julho-2026',
    type: 'income',
    category: 'Extras/Reembolsos',
    amount: 120,
    isFixed: false,
    isProvision: false,
    isRecurring: false,
    isReimbursement: true,
    card: null,
    createdAt: '2026-07-10',
  },
];

// ---------------------------------------------------------------------------
// Custos fixos (sem cartão de crédito — pagas via boleto/débito)
// ---------------------------------------------------------------------------
const fixos: Transaction[] = [
  {
    id: 'f1',
    monthId: 'julho-2026',
    type: 'expense',
    category: 'Seguro',
    amount: 269.86,
    isFixed: true,
    isProvision: false,
    isRecurring: true,
    card: null,
    createdAt: '2026-07-05',
  },
  {
    id: 'f2',
    monthId: 'julho-2026',
    type: 'expense',
    category: 'Internet',
    amount: 130,
    isFixed: true,
    isProvision: false,
    isRecurring: true,
    card: null,
    createdAt: '2026-07-05',
  },
  {
    id: 'f3',
    monthId: 'julho-2026',
    type: 'expense',
    category: 'Água',
    amount: 40,
    isFixed: true,
    isProvision: false,
    isRecurring: true,
    card: null,
    createdAt: '2026-07-05',
  },
  {
    id: 'f4',
    monthId: 'julho-2026',
    type: 'expense',
    category: 'Energia',
    amount: 150,
    isFixed: true,
    isProvision: false,
    isRecurring: true,
    card: null,
    createdAt: '2026-07-05',
  },
  {
    id: 'f5',
    monthId: 'julho-2026',
    type: 'expense',
    category: 'Tim',
    amount: 74.99,
    isFixed: true,
    isProvision: false,
    isRecurring: true,
    card: null,
    createdAt: '2026-07-05',
  },
  {
    id: 'f6',
    monthId: 'julho-2026',
    type: 'expense',
    category: 'TotalPass',
    amount: 119.90,
    isFixed: true,
    isProvision: false,
    isRecurring: true,
    card: null,
    createdAt: '2026-07-05',
  },
];

// ---------------------------------------------------------------------------
// Reserva (abate do total; separada de custos fixos)
// ---------------------------------------------------------------------------
const reserva: Transaction = {
  id: 'rv1',
  monthId: 'julho-2026',
  type: 'expense',
  category: 'Reserva',
  amount: 1000,
  isFixed: true,
  isProvision: false,
  isRecurring: true,
  isReserve: true,
  card: null,
  createdAt: '2026-07-01',
};

// ---------------------------------------------------------------------------
// Envelope: Mercado (provisão + gasto) e Gasolina (só gasto)
// ---------------------------------------------------------------------------
const envelope: Transaction[] = [
  {
    id: 'e1',
    monthId: 'julho-2026',
    type: 'expense',
    category: 'Mercado',
    amount: 103.69,
    isFixed: false,
    isProvision: true,
    isRecurring: false,
    card: null,
    createdAt: '2026-07-01',
  },
  {
    id: 'e2',
    monthId: 'julho-2026',
    type: 'expense',
    category: 'Mercado',
    amount: 416.31,
    isFixed: false,
    isProvision: false,
    isRecurring: false,
    card: null,
    createdAt: '2026-07-15',
  },
  {
    id: 'e3',
    monthId: 'julho-2026',
    type: 'expense',
    category: 'Gasolina',
    amount: 213.57,
    isFixed: false,
    isProvision: false,
    isRecurring: false,
    card: null,
    createdAt: '2026-07-12',
  },
];

// ---------------------------------------------------------------------------
// Snapshots: faturas fechadas dos cartões Nubank e C6
// ---------------------------------------------------------------------------
const snapshots = [
  { amount: 487.11, card_id: NUBANK_ID },
  { amount: 1668.82, card_id: C6_ID },
];

// ---------------------------------------------------------------------------
// Parcelamento: Samsung
// ---------------------------------------------------------------------------
const installments = [{ installment_amount: 703.20 }];

// ---------------------------------------------------------------------------
// Semanas: cartão principal fecha dia 28 → 4 semanas no ciclo
// ---------------------------------------------------------------------------
const CLOSING_DAY = 28;
const weeksInCycle = getWeeksInCycle(CLOSING_DAY); // 4

const weeks: Week[] = Array.from({ length: weeksInCycle }, (_, i) => ({
  id: `w${i + 1}`,
  monthId: 'julho-2026',
  index: i + 1,
  budget: 0,
  spent: 0,
  remaining: 0,
}));

const allTransactions: Transaction[] = [
  ...receitas,
  ...fixos,
  reserva,
  ...envelope,
];

// ---------------------------------------------------------------------------
// Contrato de julho/2026
// ---------------------------------------------------------------------------
describe('julho/2026 — contrato financeiro', () => {
  const result = calculateSummary(allTransactions, weeks, snapshots, installments);

  it('total do mês = −53,76', () => {
    expect(result.total).toBe(-53.76);
  });

  it('receita total = 5 220 (sem contar o reembolso)', () => {
    expect(result.totalIncome).toBe(5220);
  });

  it('reembolso = 120 (separado do totalIncome)', () => {
    expect(result.reimbursementIncome).toBe(120);
  });

  it('custos fixos = 784,75', () => {
    expect(result.fixedCosts).toBe(784.75);
  });

  it('gasto nos cartões (snapshots) = 2 155,93', () => {
    expect(result.cardSpending).toBe(2155.93);
  });

  it('envelope = 629,88 (max(103,69 ; 416,31) + 213,57)', () => {
    expect(result.envelopeSpending).toBe(629.88);
  });

  it('reserva = 1 000 (separada de fixedCosts)', () => {
    expect(result.reserveSpending).toBe(1000);
    expect(result.fixedCosts).not.toBeGreaterThanOrEqual(1784.75); // reserva não entrou nos fixos
  });

  it('provisão planejada = 103,69 (só Mercado)', () => {
    expect(result.provisionPlanned).toBe(103.69);
  });

  it('provisão usada = 629,88 (Mercado 416,31 + Gasolina 213,57)', () => {
    expect(result.provisionUsed).toBe(629.88);
  });

  it('orçamento semanal = −13,44 com fechamento dia 28 (4 semanas)', () => {
    expect(weeksInCycle).toBe(4);
    expect(result.weeklyBudget).toBe(-13.44);
  });

  it('não-interferência: fixedCosts não inclui despesas vinculadas a cartões com snapshot', () => {
    // Nenhuma das transações de fixos tem card=NUBANK_ID ou card=C6_ID,
    // então fixedCosts deve ser exatamente a soma dos seis itens fixos.
    expect(result.fixedCosts).toBe(269.86 + 130 + 40 + 150 + 74.99 + 119.90);
  });

  it('se a reserva fosse contada como fixo, o total seria diferente', () => {
    // Sanidade: verifica que a engine realmente separou a reserva de fixedCosts.
    // Sem a reserva, fixedCosts não muda; a reserva some em reserveSpending.
    const semReserva = calculateSummary(
      [...receitas, ...fixos, ...envelope],
      weeks,
      snapshots,
      installments,
    );
    expect(semReserva.fixedCosts).toBe(result.fixedCosts);
    expect(semReserva.reserveSpending).toBe(0);
    expect(semReserva.total).toBe(Number((result.total + 1000).toFixed(2)));
  });
});

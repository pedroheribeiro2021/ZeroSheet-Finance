import { describe, it, expect } from 'vitest';
import { weekIndexInCycle } from '@/core/engine/weekly';

describe('weekIndexInCycle', () => {
  it('fecha dia 4: 05/07 (início do ciclo) → semana 1', () => {
    expect(weekIndexInCycle(new Date(2026, 6, 5), 4)).toBe(1);
  });

  it('fecha dia 4: 11/07 (fim da semana 1) → semana 1', () => {
    expect(weekIndexInCycle(new Date(2026, 6, 11), 4)).toBe(1);
  });

  it('fecha dia 4: 12/07 (início da semana 2) → semana 2', () => {
    expect(weekIndexInCycle(new Date(2026, 6, 12), 4)).toBe(2);
  });

  it('fecha dia 4: 04/07 (o próprio fechamento) pertence ao ciclo anterior (última semana)', () => {
    // ciclo anterior: 05/06 → 04/07 (30 dias) = 5 semanas
    expect(weekIndexInCycle(new Date(2026, 6, 4), 4)).toBe(5);
  });

  it('nunca retorna menos que 1', () => {
    expect(weekIndexInCycle(new Date(2026, 6, 5), 4)).toBeGreaterThanOrEqual(1);
  });

  it('clampa o dia de fechamento em meses curtos (fecha dia 31, ciclo cruza fevereiro)', () => {
    // fechamento clampado em janeiro (31/01) e fevereiro (28/02, 2026 não é bissexto)
    // ciclo 01/02 → 28/02: 03/02 é o 3º dia do ciclo → semana 1
    expect(weekIndexInCycle(new Date(2026, 1, 3), 31)).toBe(1);
  });
});

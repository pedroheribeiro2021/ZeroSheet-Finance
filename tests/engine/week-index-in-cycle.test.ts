import { describe, it, expect } from 'vitest';
import { weekIndexInCycle } from '@/core/engine/weekly';

describe('weekIndexInCycle', () => {
  it('fecha dia 4: 04/07 (início do ciclo, o próprio dia do fechamento) → semana 1', () => {
    // o dia do fechamento já é o início do ciclo novo — a fatura às vezes
    // fecha antes do dia programado, então tratamos esse dia como já virado.
    expect(weekIndexInCycle(new Date(2026, 6, 4), 4)).toBe(1);
  });

  it('fecha dia 4: 10/07 (fim da semana 1) → semana 1', () => {
    expect(weekIndexInCycle(new Date(2026, 6, 10), 4)).toBe(1);
  });

  it('fecha dia 4: 11/07 (início da semana 2) → semana 2', () => {
    expect(weekIndexInCycle(new Date(2026, 6, 11), 4)).toBe(2);
  });

  it('fecha dia 4: 03/07 (véspera do fechamento) pertence ao ciclo anterior (última semana)', () => {
    // ciclo anterior: 04/06 → 03/07 (29 dias) = 5 semanas
    expect(weekIndexInCycle(new Date(2026, 6, 3), 4)).toBe(5);
  });

  it('nunca retorna menos que 1', () => {
    expect(weekIndexInCycle(new Date(2026, 6, 4), 4)).toBeGreaterThanOrEqual(1);
  });

  it('clampa o dia de fechamento em meses curtos (fecha dia 31, ciclo cruza fevereiro)', () => {
    // fechamento clampado em janeiro (31/01) e fevereiro (28/02, 2026 não é bissexto)
    // ciclo 31/01 → 28/02: 03/02 é o 4º dia do ciclo → semana 1
    expect(weekIndexInCycle(new Date(2026, 1, 3), 31)).toBe(1);
  });
});

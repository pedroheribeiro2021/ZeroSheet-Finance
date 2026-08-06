import { describe, it, expect } from 'vitest';
import {
  getCycleRange,
  getWeeksRemainingInCycle,
  weekDateRangeInCycle,
  weekIndexInCycle,
} from '@/core/engine/weekly';

/**
 * O teste que faltava.
 * ---------------------
 * O app tem DUAS noções de semana que precisam concordar:
 *
 * - `weekIndexInCycle` — em que semana do ciclo uma data cai. É ela que desenha
 *   "Semana 1 (04/08–10/08)" na tela e que agrupa o gasto de cada leitura.
 * - `getWeeksRemainingInCycle` — por quantas semanas o saldo do mês é dividido
 *   no Orçamento Semanal.
 *
 * Se as duas discordarem, a tela mostra "você está na semana 1 de 5" e ao mesmo
 * tempo divide o saldo por 4 — que foi exatamente o bug relatado. A relação
 * correta é uma só:
 *
 *     restantes = total do ciclo − semana atual + 1
 *
 * Estar NA semana 1 significa que restam todas as 5, não 4: a semana em que
 * você está ainda não acabou.
 */

function totalWeeksOf(closingDay: number, from: Date): number {
  const range = getCycleRange(closingDay, from);
  const days =
    Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1;
  return Math.max(1, Math.ceil(days / 7));
}

function eachDayOfCycle(closingDay: number, from: Date): Date[] {
  const { start, end } = getCycleRange(closingDay, from);
  const days: Date[] = [];

  for (
    let d = new Date(start);
    d.getTime() <= end.getTime();
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  ) {
    days.push(d);
  }

  return days;
}

describe('as duas noções de semana concordam', () => {
  // ciclos de comprimentos diferentes, incluindo fevereiro e virada de ano
  const cenarios: { nome: string; closingDay: number; dentroDoCiclo: Date }[] =
    [
      {
        nome: 'C6 — fecha dia 4, ciclo 04/08–03/09 (31 dias)',
        closingDay: 4,
        dentroDoCiclo: new Date(2026, 7, 10),
      },
      {
        nome: 'Nubank — fecha dia 26, ciclo 26/07–25/08',
        closingDay: 26,
        dentroDoCiclo: new Date(2026, 7, 1),
      },
      {
        nome: 'fecha dia 4, ciclo de fevereiro (28 dias)',
        closingDay: 4,
        dentroDoCiclo: new Date(2026, 1, 15),
      },
      {
        nome: 'fecha dia 28, ciclo de fevereiro',
        closingDay: 28,
        dentroDoCiclo: new Date(2026, 1, 10),
      },
      {
        nome: 'fecha dia 10, virada de ano',
        closingDay: 10,
        dentroDoCiclo: new Date(2026, 11, 20),
      },
      {
        nome: 'fecha dia 31, mês curto (clamp)',
        closingDay: 31,
        dentroDoCiclo: new Date(2026, 1, 10),
      },
    ];

  for (const { nome, closingDay, dentroDoCiclo } of cenarios) {
    it(`${nome}: restantes = total − semana atual + 1, em todo dia do ciclo`, () => {
      const total = totalWeeksOf(closingDay, dentroDoCiclo);

      for (const dia of eachDayOfCycle(closingDay, dentroDoCiclo)) {
        const semanaAtual = weekIndexInCycle(dia, closingDay);
        const esperado = Math.max(1, total - semanaAtual + 1);

        expect(
          getWeeksRemainingInCycle(closingDay, dia),
          `${dia.toLocaleDateString('pt-BR')} — semana ${semanaAtual} de ${total}`,
        ).toBe(esperado);
      }
    });
  }
});

describe('o contador não cai antes da semana virar', () => {
  // Cenário exato do relato: ciclo 04/08–03/09, semana 1 vai de 04/08 a 10/08.
  const closingDay = 4;

  it('a semana 1 realmente vai de 04/08 a 10/08', () => {
    const { start } = getCycleRange(closingDay, new Date(2026, 7, 6));
    const semana1 = weekDateRangeInCycle(1, closingDay, start);

    expect(semana1.start).toEqual(new Date(2026, 7, 4));
    expect(semana1.end).toEqual(new Date(2026, 7, 10));
  });

  it('durante toda a semana 1 (04/08 a 10/08) restam 5 semanas', () => {
    for (let dia = 4; dia <= 10; dia++) {
      expect(
        getWeeksRemainingInCycle(closingDay, new Date(2026, 7, dia)),
        `dia ${dia}/08`,
      ).toBe(5);
    }
  });

  it('só em 11/08, quando a semana 2 começa, cai para 4', () => {
    expect(getWeeksRemainingInCycle(closingDay, new Date(2026, 7, 11))).toBe(4);
  });

  it('nunca aumenta ao longo do ciclo', () => {
    let anterior = Infinity;

    for (const dia of eachDayOfCycle(closingDay, new Date(2026, 7, 10))) {
      const atual = getWeeksRemainingInCycle(closingDay, dia);
      expect(atual).toBeLessThanOrEqual(anterior);
      anterior = atual;
    }
  });

  it('no último dia do ciclo (03/09) resta 1', () => {
    expect(getWeeksRemainingInCycle(closingDay, new Date(2026, 8, 3))).toBe(1);
  });
});

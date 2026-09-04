import { describe, it, expect } from 'vitest';
import {
  brazilianBankHolidays,
  describePayday,
  isBusinessDay,
  nthBusinessDay,
  paydayInMonth,
  resolveNextPaydayDate,
} from '@/core/engine/payday';

describe('feriados bancários', () => {
  it('inclui os móveis de 2026 (Páscoa em 05/04)', () => {
    const h = brazilianBankHolidays(2026);

    expect(h.has('2026-02-16')).toBe(true); // Carnaval segunda
    expect(h.has('2026-02-17')).toBe(true); // Carnaval terça
    expect(h.has('2026-04-03')).toBe(true); // Sexta-feira Santa
    expect(h.has('2026-06-04')).toBe(true); // Corpus Christi
  });

  it('inclui Consciência Negra a partir de 2024', () => {
    expect(brazilianBankHolidays(2026).has('2026-11-20')).toBe(true);
    expect(brazilianBankHolidays(2023).has('2023-11-20')).toBe(false);
  });

  it('fim de semana e feriado não são dia útil', () => {
    expect(isBusinessDay(new Date(2026, 8, 5))).toBe(false); // sábado
    expect(isBusinessDay(new Date(2026, 8, 7))).toBe(false); // Independência
    expect(isBusinessDay(new Date(2026, 8, 8))).toBe(true);
  });
});

describe('N-ésimo dia útil', () => {
  it('setembro/2026: o 5º dia útil é 08/09 — o feriado de 07/09 empurra', () => {
    // 01,02,03,04 (ter–sex) = 4 dias úteis; 05–06 fim de semana;
    // 07 Independência; 08 é o quinto.
    expect(nthBusinessDay(5, 2026, 9)).toEqual(new Date(2026, 8, 8));
  });

  it('janeiro/2026: 01/01 é feriado, o 5º dia útil cai em 08/01', () => {
    expect(nthBusinessDay(5, 2026, 1)).toEqual(new Date(2026, 0, 8));
  });

  it('fevereiro/2026: o 5º dia útil é 06/02, antes do Carnaval', () => {
    expect(nthBusinessDay(5, 2026, 2)).toEqual(new Date(2026, 1, 6));
  });

  it('n maior que os dias úteis do mês cai no último, não vaza para o mês seguinte', () => {
    const d = nthBusinessDay(40, 2026, 2);

    expect(d.getMonth()).toBe(1);
    expect(isBusinessDay(d)).toBe(true);
  });
});

describe('paydayInMonth', () => {
  it('dia fixo respeita mês curto', () => {
    expect(paydayInMonth({ mode: 'fixed-day', day: 31 }, 2026, 2)).toEqual(
      new Date(2026, 1, 28),
    );
  });

  it('dia útil muda de data a cada competência', () => {
    const rule = { mode: 'business-day' as const, day: 5 };

    expect(paydayInMonth(rule, 2026, 1)).toEqual(new Date(2026, 0, 8));
    expect(paydayInMonth(rule, 2026, 2)).toEqual(new Date(2026, 1, 6));
    expect(paydayInMonth(rule, 2026, 3)).toEqual(new Date(2026, 2, 6));
  });
});

describe('resolveNextPaydayDate', () => {
  const rule = { mode: 'business-day' as const, day: 5 };

  it('antes do dia, é este mês', () => {
    expect(resolveNextPaydayDate(rule, new Date(2026, 8, 4))).toEqual(
      new Date(2026, 8, 8),
    );
  });

  it('no próprio dia, ainda é este mês', () => {
    expect(resolveNextPaydayDate(rule, new Date(2026, 8, 8))).toEqual(
      new Date(2026, 8, 8),
    );
  });

  it('depois do dia, é o mês que vem', () => {
    // outubro/2026: 01 qui, 02 sex, 05 seg, 06 ter, 07 qua = 5º dia útil
    expect(resolveNextPaydayDate(rule, new Date(2026, 8, 20))).toEqual(
      new Date(2026, 9, 7),
    );
  });

  it('vira o ano em dezembro', () => {
    const d = resolveNextPaydayDate(rule, new Date(2026, 11, 28));

    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(0);
  });
});

describe('describePayday', () => {
  it('descreve as duas regras em português', () => {
    expect(describePayday({ mode: 'fixed-day', day: 15 })).toBe('todo dia 15');
    expect(describePayday({ mode: 'business-day', day: 5 })).toBe(
      '5º dia útil do mês',
    );
  });
});

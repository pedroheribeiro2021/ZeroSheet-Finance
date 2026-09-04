/**
 * Dia do salário — regras puras
 * =============================
 *
 * O app nasceu assumindo que o salário cai num dia fixo do mês (dia 15, no
 * caso do primeiro usuário) e deduzia esse dia do `dueDay` da maior entrada
 * recorrente. Isso quebra na hora em que a empresa paga por REGRA e não por
 * data: "quinto dia útil" cai 05/01, 04/02, 05/03… — muda todo mês, e nenhum
 * campo de "dia" consegue representar.
 *
 * Aqui os dois modelos convivem:
 *
 *   { mode: 'fixed-day',    day: 15 }  → todo dia 15
 *   { mode: 'business-day', day: 5  }  → 5º dia útil de cada mês
 *
 * Nada disso depende de I/O: recebe a configuração e a data, devolve a data.
 * Quem guarda a configuração é `user_settings` (ver
 * `core/services/settings.service.ts`).
 */

export type PaydayMode = 'fixed-day' | 'business-day';

export type PaydaySettings = {
  mode: PaydayMode;
  /** 1–31 no modo dia fixo; 1–23 no modo dia útil (nº do dia útil). */
  day: number;
};

export const DEFAULT_PAYDAY: PaydaySettings = { mode: 'fixed-day', day: 5 };

function toKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateKey(d: Date): string {
  return toKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Domingo de Páscoa (calendário gregoriano) — algoritmo anônimo/Meeus. Serve
 * de âncora para os feriados móveis: Carnaval, Sexta-feira Santa e Corpus
 * Christi. Sem eles a contagem de dias úteis erra fevereiro/março todo ano.
 */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

function shift(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Calendário BANCÁRIO nacional — que é o que importa para folha de pagamento.
 * Além dos feriados nacionais fixos, inclui Carnaval (segunda e terça),
 * Sexta-feira Santa e Corpus Christi: não são todos feriado civil, mas os
 * bancos fecham, e é por eles que o "dia útil" da folha se conta.
 *
 * Não cobre feriado estadual/municipal — a folha da maioria das empresas
 * segue o calendário nacional, e um feriado local a mais moveria o cálculo
 * para um dia em que o dinheiro não caiu de fato.
 */
export function brazilianBankHolidays(year: number): Set<string> {
  const easter = easterSunday(year);

  const fixed: [number, number][] = [
    [1, 1], // Confraternização Universal
    [4, 21], // Tiradentes
    [5, 1], // Dia do Trabalho
    [9, 7], // Independência
    [10, 12], // Nossa Senhora Aparecida
    [11, 2], // Finados
    [11, 15], // Proclamação da República
    [12, 25], // Natal
  ];

  // Consciência Negra virou feriado nacional pela Lei 14.759/2023.
  if (year >= 2024) fixed.push([11, 20]);

  const keys = fixed.map(([m, d]) => toKey(year, m, d));

  keys.push(dateKey(shift(easter, -48))); // Carnaval (segunda)
  keys.push(dateKey(shift(easter, -47))); // Carnaval (terça)
  keys.push(dateKey(shift(easter, -2))); // Sexta-feira Santa
  keys.push(dateKey(shift(easter, 60))); // Corpus Christi

  return new Set(keys);
}

export function isBusinessDay(date: Date, holidays?: Set<string>): boolean {
  const weekday = date.getDay();
  if (weekday === 0 || weekday === 6) return false;

  const set = holidays ?? brazilianBankHolidays(date.getFullYear());
  return !set.has(dateKey(date));
}

/**
 * N-ésimo dia útil da competência. Se o mês não tiver `n` dias úteis (n muito
 * alto), devolve o último — melhor cair no fim do mês do que vazar para o mês
 * seguinte e dizer que o salário cai depois de já ter caído.
 */
export function nthBusinessDay(n: number, year: number, month: number): Date {
  const holidays = brazilianBankHolidays(year);
  const target = Math.max(1, Math.floor(n));

  let count = 0;
  let last = new Date(year, month - 1, 1);

  for (let day = 1; day <= new Date(year, month, 0).getDate(); day++) {
    const date = new Date(year, month - 1, day);
    if (!isBusinessDay(date, holidays)) continue;

    count += 1;
    last = date;
    if (count === target) return date;
  }

  return last;
}

/** Dia em que o salário cai na competência (year, month = 1–12). */
export function paydayInMonth(
  settings: PaydaySettings,
  year: number,
  month: number,
): Date {
  if (settings.mode === 'business-day') {
    return nthBusinessDay(settings.day, year, month);
  }

  // Dia fixo: mês curto puxa para o último dia (dia 31 em fevereiro vira 28/29).
  const lastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(settings.day, lastDay));
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Próxima ocorrência do salário a partir de `today` (inclusive): se ainda não
 * passou nesta competência é esta, senão a próxima.
 */
export function resolveNextPaydayDate(
  settings: PaydaySettings,
  today: Date,
): Date {
  const thisMonth = paydayInMonth(
    settings,
    today.getFullYear(),
    today.getMonth() + 1,
  );

  if (startOfDay(thisMonth).getTime() >= startOfDay(today).getTime()) {
    return thisMonth;
  }

  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return paydayInMonth(settings, next.getFullYear(), next.getMonth() + 1);
}

/** Texto curto para a UI ("todo dia 15", "5º dia útil do mês"). */
export function describePayday(settings: PaydaySettings): string {
  return settings.mode === 'business-day'
    ? `${settings.day}º dia útil do mês`
    : `todo dia ${settings.day}`;
}

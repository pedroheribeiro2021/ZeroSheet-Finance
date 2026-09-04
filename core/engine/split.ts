import { TransactionType } from '../types/finance';

/**
 * Split (+/-) — o sinal do valor decide se soma ou subtrai
 * ========================================================
 *
 * Herdado da planilha, onde existe a linha `(+/-) Split`: um acerto de contas
 * com outra pessoa (rateio de conta, viagem, presente dividido) que num mês
 * fecha a favor e no outro contra. Na planilha era uma célula só, ora
 * positiva ora negativa, e o usuário não queria decidir "isso é receita ou
 * despesa?" antes de digitar — ele quer digitar o saldo e pronto.
 *
 * Como funciona: com o Split ligado no formulário, o campo de valor aceita
 * sinal (`sanitizeAmountInput(value, true)`) e esta função traduz o número
 * sinalizado para o par `{ type, amount }` que o resto do sistema já entende:
 *
 *   -63,56  →  { type: 'expense', amount: 63.56 }   subtrai do mês
 *   +51,00  →  { type: 'income',  amount: 51 }      soma no mês
 *        0  →  { type: 'income',  amount: 0 }       neutro
 *
 * Por que assim, e não com um terceiro tipo de transação: depois de resolvido
 * o lançamento é uma entrada ou uma despesa comum, sem nada de especial. Não
 * há coluna `is_split` no banco, nem um `type: 'split'` — `calculateSummary`,
 * os envelopes, o gráfico e a lista não precisam saber que o Split existe.
 * Ele é só uma comodidade de digitação: vive no formulário, morre no submit.
 *
 * Consequências que valem saber antes de mexer:
 * - a flag NÃO é persistida; reabrindo a transação para editar, ela aparece
 *   como entrada ou despesa normal (o sinal já foi consumido);
 * - por isso não existe "tag de Split" na lista de lançamentos;
 * - reserva (`kind === 'reserve'`) não usa Split: reserva é sempre saída;
 * - zero cai em `income` de propósito — um acerto que fechou empatado não
 *   deve virar despesa de R$ 0,00 e sujar a lista de despesas.
 *
 * A funcionalidade continua valendo como está. Este bloco existe porque o
 * comportamento "o mesmo campo às vezes soma, às vezes subtrai" não se explica
 * sozinho lendo três linhas de código.
 */
export function resolveSplitAmount(amount: number): {
  type: TransactionType;
  amount: number;
} {
  return amount < 0
    ? { type: 'expense', amount: Math.abs(amount) }
    : { type: 'income', amount };
}

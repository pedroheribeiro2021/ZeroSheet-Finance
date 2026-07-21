export type DBTransaction = {
  id: string;
  created_at: string;

  month_id: string;

  type: 'income' | 'expense';
  category: string;
  /** Nome do lançamento (ex.: 'Claude'); category agrupa (ex.: 'Assinaturas'). */
  description?: string | null;
  amount: number;

  is_fixed: boolean;
  is_provision: boolean;

  is_recurring: boolean;
  due_day: number | null;

  /** Última competência (YYYY-MM-01) da recorrência; null = para sempre. */
  recurring_until?: string | null;

  /**
   * Ainda não existe no schema do Supabase (ver PARIDADE-PLANILHA.md item 2)
   * — opcional até a migration ser aplicada; mapTransaction trata ausência
   * como `false` para não alterar o comportamento de dados existentes.
   */
  is_reimbursement?: boolean | null;

  /** Idem is_reimbursement: ainda não existe no schema (item 3). */
  is_reserve?: boolean | null;

  /** Controle de vencimento: quando o vencimento do mês foi pago; null = não pago. */
  paid_at?: string | null;

  /** "Pausado neste mês": não conta em nenhum cálculo; a cópia de recorrência não propaga. */
  skipped?: boolean | null;

  card: string | null;
};

export type DBMonth = {
  id: string;
  month: number;
  year: number;
  created_at: string;
};

export type DBCard = {
  id: string;
  user_id: string;

  name: string;
  slug: string | null;
  color: string | null;
  limit_amount: number;
  closing_day: number | null;
  due_day: number | null;

  /**
   * Ainda não existe no schema — aguardando migration (Item A).
   * Ausência/null é tratada como false para não alterar dados existentes.
   */
  is_primary?: boolean | null;

  created_at: string | null;
};

export type DBCardSnapshot = {
  id: string;
  month_id: string | null;
  card_id: string | null;
  user_id: string | null;

  amount: number;

  /**
   * Controle de vencimento: quando a fatura do mês foi paga; null = não paga.
   * Ainda não existe no schema — aguardando migration (20260715_01).
   */
  paid_at?: string | null;

  created_at: string | null;
};

/**
 * Leitura parcial da fatura — lançada toda semana para acompanhar o ciclo.
 * Tabela card_readings ainda não existe (aguardando migration do Item C).
 */
export type DBCardReading = {
  id: string;
  user_id: string;
  month_id: string | null;
  card_id: string | null;
  amount: number;
  read_at: string;
  created_at: string | null;
};

/**
 * Assinatura de Web Push do navegador/dispositivo do usuário.
 * Tabela ainda não existe (migration `20260710_02`).
 */
export type DBPushSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string | null;
};

/** Conta bancária com saldo informado manualmente (tabela `accounts`). */
export type DBAccount = {
  id: string;
  user_id: string;

  name: string;
  kind: 'corrente' | 'guardado';
  color: string | null;

  /** Conta de onde saem os pagamentos por padrão (projeção do dashboard). */
  is_payment_default: boolean;

  created_at: string;
};

/** Leitura manual de saldo de uma conta (tabela `account_readings`). */
export type DBAccountReading = {
  id: string;
  user_id: string;
  account_id: string;
  amount: number;
  read_at: string;
  created_at: string;
};

/**
 * Transferência entre contas próprias (tabela `transfers`). NÃO é receita
 * nem despesa — não entra em calculateSummary.
 */
export type DBTransfer = {
  id: string;
  user_id: string;

  from_account_id: string;
  to_account_id: string;
  amount: number;

  /**
   * complemento = empréstimo entre contas (gera pendência de devolução)
   * devolucao   = quita um complemento (via linked_transfer_id)
   * movimentacao = transferência comum, sem pendência
   */
  kind: 'complemento' | 'devolucao' | 'movimentacao';
  linked_transfer_id: string | null;
  note: string | null;
  transferred_at: string;

  created_at: string;
};

export type DBInstallment = {
  id: string;
  user_id: string | null;
  card_id: string | null;

  description: string;
  total_amount: number;
  installment_amount: number;
  total_installments: number;
  current_installment: number | null;
  start_month_id: string | null;

  /**
   * Dia do mês em que a parcela é lançada na fatura (1-31). Ainda não existe
   * em produção até a migration `20260712_01` ser aplicada; null = sem data
   * definida (a parcela não é excluída do delta bruto do acompanhamento
   * semanal até o usuário preencher).
   */
  billing_day?: number | null;

  created_at: string | null;

  /** Relação trazida pelo select de installment.service.ts (`cards (id, name)`). */
  cards?: { id: string; name: string } | null;
};

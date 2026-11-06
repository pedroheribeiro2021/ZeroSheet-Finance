-- Despesa no cartão paga com dinheiro da reserva (viagem, por exemplo).
--
-- A compra continua na fatura — é a fatura que o banco cobra —, mas o dinheiro
-- que a cobre sai de uma reserva juntada antes, não do mês. Por isso ela não
-- abate o Saldo do Mês nem conta como gasto livre da semana.
--
-- Antes isso exigia dois lançamentos casados ("Será reembolsada" + uma entrada
-- de reembolso de mesmo valor); com a flag, basta um.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_reserve_funded boolean NOT NULL DEFAULT false;

-- Configurações por usuário. Nasce com uma só pergunta, a que o app assumia
-- sozinho até aqui: QUANDO o salário cai.
--
-- Antes o dia era deduzido do `due_day` da maior entrada recorrente — o que
-- só funciona para quem recebe em dia fixo. Quem recebe no "quinto dia útil"
-- não tem dia fixo: cai 05/01, 04/02, 05/03… Por isso a regra virou par
-- (modo, número):
--
--   ('fixed-day',    15) → todo dia 15
--   ('business-day',  5) → 5º dia útil do mês
--
-- Quem resolve a data a partir daqui é `core/engine/payday.ts` (feriados
-- bancários nacionais incluídos). Uma linha por usuário; sem linha, o app cai
-- no comportamento antigo de deduzir das entradas.

CREATE TABLE public.user_settings (
  user_id      uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payday_mode  text        NOT NULL DEFAULT 'fixed-day'
                           CHECK (payday_mode IN ('fixed-day', 'business-day')),
  -- 1–31 no modo dia fixo; 1–23 no modo dia útil (nenhum mês tem mais que 23)
  payday_day   smallint    NOT NULL DEFAULT 5
                           CHECK (payday_day BETWEEN 1 AND 31),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- RLS: dono da linha (user_id = auth.uid()) lê e escreve; ninguém mais.
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_settings_owner ON public.user_settings;
CREATE POLICY user_settings_owner ON public.user_settings
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

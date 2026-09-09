-- Remove policies de RLS permissivas ("allow all", USING (true)) deixadas de
-- um schema inicial reaproveitado (judotracker_init_schema). Por serem
-- policies ADICIONAIS (RLS combina policies permissivas com OR), elas
-- anulavam a policy de dono (auth.uid() = user_id) nestas 4 tabelas — e como
-- o papel `anon` tem grants de SELECT/INSERT/UPDATE/DELETE nelas, qualquer
-- pessoa com a anon key (pública, embutida no bundle do client) conseguia
-- ler/alterar/apagar transações, faturas lançadas, meses e semanas de
-- QUALQUER usuário, sem estar logada.
drop policy if exists "allow all transactions" on public.transactions;
drop policy if exists "allow all snapshots" on public.card_snapshots;
drop policy if exists "allow all months" on public.months;
drop policy if exists "allow all weeks" on public.weeks;

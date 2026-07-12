-- Agendamento (cron) da Edge Function send-due-notifications.
-- Rodar manualmente no SQL Editor do Supabase depois de:
--   1. Implantar a função (`supabase functions deploy send-due-notifications`
--      ou via MCP `deploy_edge_function`) com verify_jwt=false;
--   2. Definir os secrets da função: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
--      VAPID_SUBJECT, CRON_SECRET (`supabase secrets set ...`);
--   3. Substituir <PROJECT_REF> e <CRON_SECRET> abaixo pelos valores reais
--      (o CRON_SECRET é o mesmo valor setado no passo 2 — um token
--      aleatório gerado por você, nunca a service_role key).
--
-- Requer as extensões pg_cron e pg_net habilitadas no projeto
-- (Database → Extensions).

select
  cron.schedule(
    'send-due-notifications-daily',
    -- 11:00 UTC ≈ 08:00 America/Sao_Paulo (sem horário de verão hoje em dia).
    -- Ajuste o horário conforme preferir.
    '0 11 * * *',
    $$
    select
      net.http_post(
        url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-due-notifications',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer <CRON_SECRET>'
        ),
        body := '{}'::jsonb
      ) as request_id;
    $$
  );

-- Para conferir se está agendado:
--   select * from cron.job;
-- Para remover o agendamento:
--   select cron.unschedule('send-due-notifications-daily');

// Edge Function agendada (cron) — dispara Web Push para despesas fixas/
// recorrentes que vencem HOJE (due_day = dia de hoje), ainda não pagas
// (paid_at IS NULL), no mês corrente de cada usuário.
//
// NÃO IMPLANTADA/AGENDADA em produção — ver supabase/functions/send-due-notifications/schedule.sql
// e o TODO.md para o passo a passo de ativação.
//
// Env vars exigidas (Edge Function secrets, não .env.local do Next.js):
//   SUPABASE_URL               — já injetada automaticamente pelo runtime
//   SUPABASE_SERVICE_ROLE_KEY  — já injetada automaticamente pelo runtime
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT               — ex.: "mailto:voce@exemplo.com"

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT');

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return new Response('Missing required env vars', { status: 500 });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const now = new Date();
  const today = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const { data: months, error: monthsError } = await supabase
    .from('months')
    .select('id, user_id')
    .eq('month', month)
    .eq('year', year);

  if (monthsError) {
    return new Response(`Failed to load months: ${monthsError.message}`, { status: 500 });
  }

  const monthIds = (months ?? []).map((m) => m.id);
  if (monthIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no months for current period' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: dueTransactions, error: txError } = await supabase
    .from('transactions')
    .select('id, user_id, description, category, amount, due_day, is_fixed, is_recurring, type, paid_at, month_id')
    .in('month_id', monthIds)
    .eq('type', 'expense')
    .eq('due_day', today)
    .is('paid_at', null);

  if (txError) {
    return new Response(`Failed to load transactions: ${txError.message}`, { status: 500 });
  }

  const dueToday = (dueTransactions ?? []).filter((t) => t.is_fixed || t.is_recurring);
  if (dueToday.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no due transactions today' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userIds = [...new Set(dueToday.map((t) => t.user_id))];

  const { data: subscriptions, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', userIds);

  if (subsError) {
    return new Response(`Failed to load subscriptions: ${subsError.message}`, { status: 500 });
  }

  let sent = 0;
  let removed = 0;

  for (const userId of userIds) {
    const userDue = dueToday.filter((t) => t.user_id === userId);
    const userSubs = (subscriptions ?? []).filter((s) => s.user_id === userId);

    if (userSubs.length === 0) continue;

    const title = userDue.length === 1 ? 'Vencimento hoje' : `${userDue.length} vencimentos hoje`;
    const body = userDue
      .map((t) => `${t.description || t.category} — ${formatBRL(Number(t.amount))}`)
      .join(', ');

    const payload = JSON.stringify({ title, body, url: '/dashboard' });

    for (const sub of userSubs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );
        sent++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          removed++;
        } else {
          console.error(`push failed for subscription ${sub.id}:`, err);
        }
      }
    }
  }

  return new Response(JSON.stringify({ sent, removed, dueCount: dueToday.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

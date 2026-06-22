# ZeroSheet Finance

App de finanças pessoais multiusuário baseado em lógica de planilha: meses,
transações, cartões com fatura mensal, parcelamentos e orçamento dividido em
semanas, tudo agregado num dashboard.

Para contexto detalhado de arquitetura, estrutura de pastas e estado atual do
desenvolvimento, veja [CONTEXT.md](./CONTEXT.md).

## Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- Supabase (Auth + Postgres com RLS)
- Vitest + Testing Library
- TypeScript (strict)

## Rodar local

```bash
npm install
npm run dev
```

Requer um projeto Supabase configurado e um `.env.local` com
`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` / `npm start` — build de produção
- `npm run lint` — ESLint
- `npm test` / `npm run test:watch` / `npm run test:coverage` — Vitest
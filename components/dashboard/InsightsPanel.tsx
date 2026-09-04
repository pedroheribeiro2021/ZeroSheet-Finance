'use client';

import { Insight, InsightTone } from '@/core/engine/insights';

type Props = {
  insights: Insight[];
};

/**
 * As mesmas cores do resto do app, mas com um papel diferente: aqui a cor É a
 * informação (estourou / no limite / dentro), então cada item também carrega
 * um símbolo — quem não distingue vermelho de verde continua lendo o veredito.
 */
const TONE_STYLES: Record<InsightTone, { box: string; text: string; mark: string }> = {
  bad: {
    box: 'border-red-500/25 bg-red-500/10',
    text: 'text-red-300',
    mark: '▲',
  },
  warn: {
    box: 'border-amber-500/25 bg-amber-500/10',
    text: 'text-amber-300',
    mark: '!',
  },
  good: {
    box: 'border-green-500/20 bg-green-500/[0.07]',
    text: 'text-green-300',
    mark: '✓',
  },
  neutral: {
    box: 'border-white/[0.06] bg-white/[0.03]',
    text: 'text-zinc-300',
    mark: '•',
  },
};

export default function InsightsPanel({ insights }: Props) {
  if (insights.length === 0) return null;

  return (
    <div className="surface p-4 sm:p-5">
      <h2 className="mb-1 text-base font-semibold text-white">
        Leitura do mês
      </h2>
      <p className="mb-4 text-xs text-zinc-500">
        Os mesmos números dos cards, já interpretados: o que sobrou, o que
        estourou e o que está no caminho de estourar.
      </p>

      <div className="grid gap-2">
        {insights.map((insight) => {
          const tone = TONE_STYLES[insight.tone];

          return (
            <div
              key={insight.id}
              className={`flex gap-2.5 rounded-xl border p-3 ${tone.box}`}
            >
              <span
                aria-hidden
                className={`mt-0.5 shrink-0 text-xs font-bold ${tone.text}`}
              >
                {tone.mark}
              </span>

              <div className="min-w-0">
                <p className={`text-sm font-semibold ${tone.text}`}>
                  {insight.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                  {insight.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

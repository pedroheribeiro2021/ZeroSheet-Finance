'use client';

import { useEffect, useState } from 'react';
import { getUsedCategories } from '@/core/services/transaction.service';
import {
  CategoryKind,
  UsedCategory,
  categoryOptions,
} from '@/core/engine/categories';

const CUSTOM = '__custom__';

type Props = {
  kind: CategoryKind;
  value: string;
  onChange: (category: string) => void;
};

/**
 * Seletor de categoria com as padrão + as que o usuário já criou. O campo de
 * texto só aparece em "Outra...": é onde se cria uma categoria nova, que
 * passa a constar no seletor assim que o lançamento é salvo.
 *
 * Para limpar depois de salvar, o pai remonta o campo (`key`) — isso também
 * recarrega a lista, já com a categoria recém-criada.
 */
export default function CategoryField({ kind, value, onChange }: Props) {
  const [used, setUsed] = useState<UsedCategory[]>([]);
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    getUsedCategories()
      .then(setUsed)
      .catch(() => setUsed([]));
  }, []);

  // No modo "Outra..." o que está sendo digitado não entra na lista — senão o
  // seletor trocaria de opção a cada tecla.
  const { defaults, custom } = categoryOptions(
    kind,
    used,
    isCustom ? null : value,
  );

  return (
    <>
      <select
        value={isCustom ? CUSTOM : value}
        onChange={(e) => {
          if (e.target.value === CUSTOM) {
            setIsCustom(true);
            onChange('');
            return;
          }

          setIsCustom(false);
          onChange(e.target.value);
        }}
        className="field"
      >
        {!value && !isCustom && (
          <option value="">Selecione uma categoria</option>
        )}

        {defaults.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}

        {custom.length > 0 && (
          <optgroup label="Suas categorias">
            {custom.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </optgroup>
        )}

        <option value={CUSTOM}>Outra... (criar categoria)</option>
      </select>

      {isCustom && (
        <input
          type="text"
          autoFocus
          placeholder="Nova categoria (ex: Mercado / Alimentação)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field"
        />
      )}
    </>
  );
}

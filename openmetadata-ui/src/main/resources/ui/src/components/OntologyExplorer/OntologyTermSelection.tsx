/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import {
  Card,
  Checkbox,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyNode } from './OntologyExplorer.interface';
import { isTermNode } from './utils/graphBuilders';

interface OntologyTermSelectionProps {
  label: string;
  maxItems: number;
  nodes: OntologyNode[];
  selectedIds: string[];
  onChange: (termIds: string[]) => void;
}

const OntologyTermSelection = ({
  label,
  maxItems,
  nodes,
  selectedIds,
  onChange,
}: OntologyTermSelectionProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const candidates = useMemo(
    () =>
      nodes
        .filter(isTermNode)
        .filter((node) => matches(node, query))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [nodes, query]
  );

  const toggle = (termId: string, isSelected: boolean) => {
    const next = isSelected
      ? [...selectedIds, termId].slice(0, maxItems)
      : selectedIds.filter((selectedId) => selectedId !== termId);
    onChange(next);
  };

  return (
    <Card className="tw:flex tw:flex-col tw:gap-3 tw:border tw:border-secondary tw:p-4 tw:ring-0">
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
        <Typography size="text-sm" weight="semibold">
          {label}
        </Typography>
        <Typography className="tw:text-tertiary" size="text-xs">
          {t('label.n-selected', { count: selectedIds.length })}
        </Typography>
      </div>
      <Input
        aria-label={t('label.search')}
        placeholder={t('label.search')}
        value={query}
        onChange={setQuery}
      />
      <div className="tw:flex tw:max-h-64 tw:flex-col tw:gap-2 tw:overflow-auto">
        {candidates.map((node) => {
          const termId = node.termId ?? node.id;
          const isSelected = selectedIds.includes(termId);

          return (
            <Checkbox
              isDisabled={!isSelected && selectedIds.length >= maxItems}
              isSelected={isSelected}
              key={termId}
              label={node.originalLabel ?? node.label}
              onChange={(selected) => toggle(termId, selected)}
            />
          );
        })}
      </div>
    </Card>
  );
};

const matches = (node: OntologyNode, query: string) => {
  const normalized = query.trim().toLocaleLowerCase();
  const label = (node.originalLabel ?? node.label).toLocaleLowerCase();
  const result = !normalized || label.includes(normalized);

  return result;
};

export default OntologyTermSelection;

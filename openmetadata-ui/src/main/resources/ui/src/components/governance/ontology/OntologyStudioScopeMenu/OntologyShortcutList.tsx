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
import { Button, Input } from '@openmetadata/ui-core-components';
import { Search } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useOntologyConceptCounts } from '../../../../hooks/governance/ontology/useOntologyStudioScopes';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { filterOntologies } from './OntologyStudioScopeMenu.utils';

interface OntologyShortcutListProps {
  readonly ontologies: readonly Ontology[];
  readonly onSelect: (ontology: Ontology) => void;
}

const OntologyShortcutList = ({
  ontologies,
  onSelect,
}: OntologyShortcutListProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const counts = useOntologyConceptCounts([...ontologies], true);
  const visible = filterOntologies(ontologies, query);

  return (
    <div
      className="tw:flex tw:w-full tw:max-w-120 tw:flex-col tw:gap-3"
      data-testid="ontology-shortcut-list">
      <Input
        aria-label={t('label.search-entity', {
          entity: t('label.ontology-plural'),
        })}
        icon={Search}
        inputDataTestId="ontology-shortcut-search"
        placeholder={t('label.search-entity', {
          entity: t('label.ontology-plural'),
        })}
        size="sm"
        value={query}
        onChange={setQuery}
      />
      <ul className="tw:m-0 tw:flex tw:max-h-72 tw:list-none tw:flex-col tw:gap-1 tw:overflow-y-auto tw:p-0">
        {visible.map((ontology) => {
          const count = counts[ontology.id];

          return (
            <li key={ontology.id}>
              <Button
                className="tw:w-full tw:justify-between"
                color="secondary"
                data-testid={`ontology-shortcut-${ontology.id}`}
                size="sm"
                onPress={() => onSelect(ontology)}>
                <span className="tw:min-w-0 tw:truncate">
                  {getEntityName(ontology)}
                </span>
                {count === undefined ? null : (
                  <span className="tw:shrink-0 tw:text-tertiary">
                    {`${count} ${t(
                      'label.concept-plural'
                    ).toLocaleLowerCase()}`}
                  </span>
                )}
              </Button>
            </li>
          );
        })}
      </ul>
      {visible.length === 0 ? (
        <span className="tw:text-sm tw:text-tertiary">
          {t('message.ontology-picker-no-match', { query: query.trim() })}
        </span>
      ) : null}
    </div>
  );
};

export default OntologyShortcutList;

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
import { Autocomplete } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/type/entityReference';
import { searchQuery } from '../../../rest/searchAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

export type OnboardingSearchIndex =
  | SearchIndex.USER
  | SearchIndex.TEAM
  | SearchIndex.DOMAIN
  | SearchIndex.METRIC
  | SearchIndex.GLOSSARY
  | SearchIndex.GLOSSARY_TERM
  | SearchIndex.TAG;
interface Props {
  value: EntityReference[];
  onChange: (value: EntityReference[]) => void;
  label?: string;
  searchIndex?: OnboardingSearchIndex[];
  isSelectable?: (reference: EntityReference) => boolean;
}
const DEFAULT_INDICES: OnboardingSearchIndex[] = [
  SearchIndex.USER,
  SearchIndex.TEAM,
];
const sameReference = (left: EntityReference, right: EntityReference) =>
  left.id === right.id ||
  (left.type === right.type &&
    Boolean(left.fullyQualifiedName) &&
    left.fullyQualifiedName === right.fullyQualifiedName);

export const OnboardingAssignees = ({
  value,
  onChange,
  label,
  searchIndex = DEFAULT_INDICES,
  isSelectable,
}: Props) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<EntityReference[]>([]);
  const sequence = useRef(0);
  const search = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const response = await searchQuery({
        query: query || '*',
        pageNumber: 1,
        pageSize: 25,
        searchIndex,
        includeFields: [
          ...([
            'id',
            'entityType',
            'name',
            'displayName',
            'fullyQualifiedName',
          ] as const),
        ],
      });
      if (request !== sequence.current) {
        return;
      }
      setOptions(
        response.hits.hits
          .map(({ _source }) => ({
            id: _source.id,
            type: _source.entityType,
            name: _source.name,
            displayName: _source.displayName,
            fullyQualifiedName: _source.fullyQualifiedName,
          }))
          .filter((reference) => !isSelectable || isSelectable(reference))
      );
    } catch (error) {
      if (request === sequence.current) {
        showErrorToast(error as AxiosError);
      }
    }
  }, [query, searchIndex, isSelectable]);
  useEffect(() => {
    const timer = setTimeout(search, 300);

    return () => {
      clearTimeout(timer);
      sequence.current++;
    };
  }, [search]);
  const items = [
    ...value,
    ...options.filter(
      (option) => !value.some((selected) => sameReference(selected, option))
    ),
  ].map((option) => ({ id: option.id, label: getEntityName(option) }));

  return (
    <Autocomplete
      filterOption={() => true}
      items={items}
      label={label ?? t('label.assignee-plural')}
      selectedItems={value.map((option) => ({
        id: option.id,
        label: getEntityName(option),
      }))}
      onItemCleared={(key) =>
        onChange(value.filter((option) => option.id !== key))
      }
      onItemInserted={(key) => {
        const option = options.find((item) => item.id === key);
        if (option && !value.some((item) => item.id === key)) {
          onChange([...value, option]);
        }
      }}
      onSearchChange={setQuery}>
      {(item) => <Autocomplete.Item id={item.id} label={item.label} />}
    </Autocomplete>
  );
};

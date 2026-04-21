/*
 *  Copyright 2022 Collate.
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

import { Autocomplete, Button, Select } from '@openmetadata/ui-core-components';
import { Trash01 } from '@untitledui/icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import { PAGE_SIZE_MEDIUM } from '../../../../constants/constants';
import { EntityType } from '../../../../enums/entity.enum';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../../generated/entity/type';
import { searchGlossaryTermsPaginated } from '../../../../rest/glossaryAPI';
import {
  getEntityName,
  getEntityReferenceFromEntity,
} from '../../../../utils/EntityUtils';
import {
  TermItem,
  TermSelectItem,
  TermsRowEditorProps,
  TermsRowProps,
} from './RelatedTerms.interface';

const TermsRow: React.FC<TermsRowProps> = ({
  rowId,
  initialRelationType,
  initialTerms,
  relationTypeOptions,
  excludeFQN,
  preloadedTerms,
  onRelationTypeChange,
  onTermsChange,
  onRemove,
}) => {
  const { t } = useTranslation();
  const [relationType, setRelationType] = useState(initialRelationType);
  const [selectedTerms, setSelectedTerms] = useState<TermSelectItem[]>(
    initialTerms.map((term) => ({ id: term.value, label: term.label }))
  );
  const [searchedTerms, setSearchedTerms] = useState<GlossaryTerm[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTerms = searchedTerms.length > 0 ? searchedTerms : preloadedTerms;

  const termEntityMap = useMemo(() => {
    const map: Record<string, EntityReference> = {};
    [...preloadedTerms, ...searchedTerms].forEach((term) => {
      if (term.fullyQualifiedName) {
        map[term.fullyQualifiedName] = getEntityReferenceFromEntity(
          term,
          EntityType.GLOSSARY_TERM
        );
      }
    });
    initialTerms.forEach((term) => {
      if (term.entity) {
        map[term.value] = term.entity;
      }
    });

    return map;
  }, [preloadedTerms, searchedTerms, initialTerms]);

  const dropdownItems = useMemo<TermSelectItem[]>(
    () =>
      activeTerms
        .filter((term) => term.fullyQualifiedName !== excludeFQN)
        .map((term) => ({
          id: term.fullyQualifiedName ?? '',
          label: getEntityName(term),
        })),
    [activeTerms, excludeFQN]
  );

  const toTermItems = useCallback(
    (items: TermSelectItem[]): TermItem[] =>
      items.map((i) => ({
        entity: termEntityMap[i.id],
        label: i.label ?? '',
        value: i.id,
      })),
    [termEntityMap]
  );

  const handleRelationTypeChange = useCallback(
    (key: Key | null) => {
      setRelationType(String(key ?? ''));
      onRelationTypeChange(rowId, String(key ?? ''));
    },
    [rowId, onRelationTypeChange]
  );

  const handleSearchChange = useCallback((value: string) => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    if (!value.trim()) {
      setSearchedTerms([]);

      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const result = await searchGlossaryTermsPaginated({
          q: value,
          limit: PAGE_SIZE_MEDIUM,
          offset: 0,
        });
        setSearchedTerms(result.data);
      } catch {
        // search failures fall back to preloaded terms
      }
    }, 300);
  }, []);

  const handleItemInserted = useCallback(
    (key: Key) => {
      const term = [...preloadedTerms, ...searchedTerms].find(
        (t) => t.fullyQualifiedName === key
      );
      if (term) {
        const updated = [
          ...selectedTerms,
          { id: term.fullyQualifiedName ?? '', label: getEntityName(term) },
        ];
        setSelectedTerms(updated);
        onTermsChange(rowId, toTermItems(updated));
      }
    },
    [
      preloadedTerms,
      searchedTerms,
      selectedTerms,
      rowId,
      onTermsChange,
      toTermItems,
    ]
  );

  const handleItemCleared = useCallback(
    (key: Key) => {
      const updated = selectedTerms.filter((i) => i.id !== key);
      setSelectedTerms(updated);
      onTermsChange(rowId, toTermItems(updated));
    },
    [selectedTerms, rowId, onTermsChange, toTermItems]
  );

  return (
    <div
      className="d-flex items-center gap-3"
      data-testid={`relation-row-${rowId}`}>
      <div className="tw:w-67.5 tw:shrink-0">
        <Select
          className="w-full"
          fontSize="sm"
          items={relationTypeOptions}
          size="sm"
          value={relationType}
          onChange={handleRelationTypeChange}>
          {(item) => (
            <Select.Item id={item.id} key={item.id} label={item.label} />
          )}
        </Select>
      </div>
      <div className="tw:flex-1" data-testid={`term-autocomplete-${rowId}`}>
        <Autocomplete
          filterOption={() => true}
          items={dropdownItems}
          maxVisibleItems={3}
          placeholder={t('label.add-entity', {
            entity: t('label.term-plural'),
          })}
          selectedItems={selectedTerms}
          onItemCleared={handleItemCleared}
          onItemInserted={handleItemInserted}
          onSearchChange={handleSearchChange}>
          {(item) => (
            <Autocomplete.Item id={item.id} key={item.id} label={item.label} />
          )}
        </Autocomplete>
      </div>
      <Button
        color="tertiary-destructive"
        data-testid={`remove-row-${rowId}`}
        iconLeading={Trash01}
        size="sm"
        onClick={() => onRemove(rowId)}
      />
    </div>
  );
};

const TermsRowEditor: React.FC<TermsRowEditorProps> = ({
  rows,
  excludeFQN,
  preloadedTerms,
  relationTypeOptions,
  onAddRow,
  onRelationTypeChange,
  onTermsChange,
  onRemove,
}) => {
  const { t } = useTranslation();

  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      {rows.map((row) => (
        <TermsRow
          excludeFQN={excludeFQN}
          initialRelationType={row.relationType}
          initialTerms={row.terms}
          key={row.id}
          preloadedTerms={preloadedTerms}
          relationTypeOptions={relationTypeOptions}
          rowId={row.id}
          onRelationTypeChange={onRelationTypeChange}
          onRemove={onRemove}
          onTermsChange={onTermsChange}
        />
      ))}
      <Button
        className="tw:w-fit"
        color="tertiary"
        data-testid="add-row-button"
        size="sm"
        onClick={onAddRow}>
        {`+ ${t('label.add-entity', {
          entity: t('label.related-term-plural'),
        })}`}
      </Button>
    </div>
  );
};

export default TermsRowEditor;

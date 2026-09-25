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
  Autocomplete,
  Badge,
  Box,
  SelectItemType,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { debounce, isArray } from 'lodash';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PAGE_SIZE } from '../../../../../constants/constants';
import { EntityType } from '../../../../../enums/entity.enum';
import { EntityReference } from '../../../../../generated/entity/type';
import { searchQuery } from '../../../../../rest/searchAPI';
import { getCustomPropertyReferenceSearchIndex } from '../../../../../utils/CustomProperty.utils';
import { getEntityIcon } from '../../../../../utils/EntityIconUtils';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { getEntityReferenceFromEntity } from '../../../../../utils/EntityReferenceUtils';
import entityUtilClassBase from '../../../../../utils/EntityUtilClassBase';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import { CollapsibleChipList } from '../CollapsibleChipList';
import { ENTITY_REFERENCE_VISIBLE_COUNT } from '../CustomPropertyCard.constants';
import {
  CustomPropertyRenderer,
  PropertyEditProps,
  PropertyViewProps,
} from '../CustomPropertyCard.types';

const SEARCH_DEBOUNCE_MS = 300;
const ENTITY_REFERENCE_LIST = 'entityReferenceList';

const toReferenceList = (value: unknown): EntityReference[] =>
  (isArray(value) ? value : [value]).filter((item): item is EntityReference =>
    Boolean(item?.id)
  );

const getReferenceKey = (reference: EntityReference) =>
  reference.fullyQualifiedName ?? reference.id;

const EntityReferenceChip = ({ reference }: { reference: EntityReference }) => (
  <Link
    className="tw:inline-flex tw:max-w-full"
    data-testid={getEntityName(reference)}
    to={entityUtilClassBase.getEntityLink(
      reference.type,
      reference.fullyQualifiedName ?? reference.name ?? ''
    )}>
    <Badge
      className="tw:max-w-full tw:gap-1.5 tw:py-[3px] tw:pr-2.5 tw:pl-2 tw:font-normal tw:text-secondary"
      color="gray"
      size="md"
      type="modern">
      {getEntityIcon(reference.type, 'tw:size-4 tw:shrink-0')}
      <span className="tw:truncate">{getEntityName(reference)}</span>
    </Badge>
  </Link>
);

const EntityReferencePropertyView = ({
  property,
  value,
}: PropertyViewProps) => (
  <CollapsibleChipList
    data-testid={
      property.propertyType.name === ENTITY_REFERENCE_LIST
        ? 'entityReferenceList-value'
        : 'entityReference-value'
    }
    getKey={(reference) => reference.id}
    items={toReferenceList(value)}
    renderItem={(reference) => <EntityReferenceChip reference={reference} />}
    visibleCount={ENTITY_REFERENCE_VISIBLE_COUNT}
  />
);

const EntityReferencePropertyEdit = ({
  property,
  value,
  isSaving,
  onSave,
  formId,
}: PropertyEditProps) => {
  const { t } = useTranslation();
  const isList = property.propertyType.name === ENTITY_REFERENCE_LIST;
  const searchIndex = getCustomPropertyReferenceSearchIndex(property);
  const [selected, setSelected] = useState<EntityReference[]>(() =>
    toReferenceList(value)
  );
  const [results, setResults] = useState<EntityReference[]>([]);

  const fetchReferences = useCallback(
    async (text: string) => {
      try {
        const response = await searchQuery({
          query: text ? `*${text}*` : '*',
          pageNumber: 1,
          pageSize: PAGE_SIZE,
          searchIndex,
          queryFilter: {
            query: { bool: { must_not: [{ match: { isBot: true } }] } },
          },
        });

        setResults(
          response.hits.hits.map(({ _source }) => {
            const source = _source as EntityReference & {
              entityType?: string;
            };

            return getEntityReferenceFromEntity(
              source,
              source.entityType as EntityType
            );
          })
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [searchIndex]
  );

  const debouncedFetch = useMemo(
    () => debounce(fetchReferences, SEARCH_DEBOUNCE_MS),
    [fetchReferences]
  );

  useEffect(() => {
    fetchReferences('');

    return () => debouncedFetch.cancel();
  }, [fetchReferences, debouncedFetch]);

  const toItem = (reference: EntityReference): SelectItemType => ({
    id: getReferenceKey(reference),
    label: getEntityName(reference),
    supportingText: reference.fullyQualifiedName,
    icon: getEntityIcon(reference.type, 'tw:size-4'),
  });

  const items = useMemo(() => results.map(toItem), [results]);
  const selectedItems = useMemo(() => selected.map(toItem), [selected]);

  const handleInsert = (key: string) => {
    const reference = results.find((item) => getReferenceKey(item) === key);
    if (reference) {
      setSelected((prev) => (isList ? [...prev, reference] : [reference]));
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(isList ? selected : selected[0]);
  };

  return (
    <form noValidate id={formId} onSubmit={handleSubmit}>
      <Box direction="col" gap={2}>
        <div data-testid="asset-select-list">
          <Autocomplete
            aria-label={property.displayName || property.name}
            filterOption={() => true}
            isDisabled={isSaving}
            items={items}
            multiple={isList}
            placeholder={t('label.search-for-type', {
              type: t('label.data-asset-plural'),
            })}
            selectedItems={selectedItems}
            onItemCleared={(key) =>
              setSelected((prev) =>
                prev.filter((item) => getReferenceKey(item) !== key)
              )
            }
            onItemInserted={(key) => handleInsert(String(key))}
            onSearchChange={debouncedFetch}>
            {(item) => (
              <Autocomplete.Item
                data-testid={item.label}
                icon={item.icon}
                id={String(item.id)}
                key={item.id}
                label={item.label}
                supportingText={item.supportingText}
              />
            )}
          </Autocomplete>
        </div>
        <span className="tw:text-xs tw:text-tertiary">
          {isList &&
            t('message.count-selected', {
              count: selected.length,
            })}
        </span>
      </Box>
    </form>
  );
};

export const entityReferencePropertyRenderer: CustomPropertyRenderer = {
  View: EntityReferencePropertyView,
  Edit: EntityReferencePropertyEdit,
};

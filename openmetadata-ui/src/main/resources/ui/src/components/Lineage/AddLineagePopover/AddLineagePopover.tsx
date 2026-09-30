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
  Popover,
  Select,
  SelectItemType,
} from '@openmetadata/ui-core-components';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Heading } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE } from '../../../constants/constants';
import { entityData } from '../../../constants/Lineage.constants';
import { SearchIndex } from '../../../enums/search.enum';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import {
  EdgeFromToData,
  LineageNodeType,
} from '../../../interface/lineage.interface';
import { searchQuery } from '../../../rest/searchAPI';
import { getEntityChildrenAndLabel } from '../../../utils/EntityLineageNodeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { AddLineagePopoverProps } from './AddLineagePopover.interface';

// Only entity types whose search hits carry columns via getEntityChildrenAndLabel's
// getTableEntityChildren resolver (reads `entityType` + `columns` directly, no
// extra nesting) can be flattened into a column picker from a raw search hit.
const COLUMN_CAPABLE_SEARCH_INDEXES: SearchIndex[] = [
  SearchIndex.TABLE,
  SearchIndex.DASHBOARD_DATA_MODEL,
];

type EntityHit = {
  id: string;
  name?: string;
  displayName?: string;
  fullyQualifiedName?: string;
  entityType?: string;
  columns?: { name: string; fullyQualifiedName?: string }[];
};

const AddLineagePopover = ({
  request,
  excludeEntityId,
  onClose,
  onSubmit,
}: AddLineagePopoverProps) => {
  const { t } = useTranslation();
  const [type, setType] = useState<SearchIndex>();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<EntityHit[]>([]);
  const [entity, setEntity] = useState<EntityHit>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isColumnTarget = Boolean(request?.columnFqn);

  useEffect(() => {
    setType(undefined);
    setQuery('');
    setHits([]);
    setEntity(undefined);
  }, [request]);

  const search = useMemo(
    () =>
      debounce(async (index: SearchIndex, text: string) => {
        const response = await searchQuery({
          query: text,
          searchIndex: index,
          pageNumber: 1,
          pageSize: PAGE_SIZE,
          includeDeleted: false,
        });
        setHits(
          response.hits.hits
            .map(({ _source }) => _source as unknown as EntityHit)
            .filter((searchHit) => searchHit.id !== excludeEntityId)
        );
      }, 300),
    [excludeEntityId]
  );

  useEffect(() => () => search.cancel(), [search]);

  const submit = useCallback(
    async (picked: EntityHit, columnFqn?: string) => {
      if (isSubmitting) {
        return;
      }
      const ref: EdgeFromToData = {
        id: picked.id,
        type: picked.entityType ?? '',
        fullyQualifiedName: picked.fullyQualifiedName,
      };
      setIsSubmitting(true);
      const ok = await onSubmit(
        columnFqn ? { entity: ref, columnFqn } : { entity: ref }
      );
      setIsSubmitting(false);
      if (ok) {
        onClose();
      }
    },
    [isSubmitting, onClose, onSubmit]
  );

  const typeItems: SelectItemType[] = useMemo(
    () =>
      (isColumnTarget
        ? entityData.filter(({ type: index }) =>
            COLUMN_CAPABLE_SEARCH_INDEXES.includes(index)
          )
        : entityData
      ).map(({ type: index, label }) => ({
        id: index,
        label: t(label),
      })),
    [isColumnTarget, t]
  );
  const entityItems: SelectItemType[] = useMemo(
    () =>
      hits.map((searchHit) => ({
        id: searchHit.id,
        label: getEntityName(searchHit),
        supportingText: searchHit.fullyQualifiedName,
      })),
    [hits]
  );
  const columnItems: SelectItemType[] = useMemo(() => {
    if (!entity) {
      return [];
    }
    const { children } = getEntityChildrenAndLabel(
      entity as unknown as LineageNodeType
    );

    return children.map((column) => ({
      id: column.fullyQualifiedName ?? column.name ?? '',
      label: column.name ?? '',
    }));
  }, [entity]);

  if (!request) {
    return null;
  }

  const isUpstream = request.direction === LineageDirection.Upstream;

  return (
    <Popover
      isOpen
      arrow={false}
      placement={isUpstream ? 'left' : 'right'}
      triggerRef={request.triggerRef}
      onOpenChange={(isPopoverOpen) =>
        !isPopoverOpen && !isSubmitting && onClose()
      }>
      <div
        className="tw:flex tw:w-80 tw:flex-col tw:gap-3 tw:p-4"
        data-testid="add-lineage-popover">
        <Heading
          className="tw:m-0! tw:text-sm tw:font-semibold tw:text-primary!"
          slot="title">
          {t(isUpstream ? 'label.add-upstream' : 'label.add-downstream')}
        </Heading>
        <Select
          data-testid="add-lineage-type-select"
          items={typeItems}
          label={t('label.select-type')}
          selectedKey={type ?? null}
          size="sm"
          onSelectionChange={(key) => {
            setType(key as SearchIndex);
            setEntity(undefined);
            setHits([]);
          }}>
          {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
        </Select>
        {type && (
          // Select.ComboBox drops data-testid, so the wrapper carries it.
          <div data-testid="add-lineage-entity-input">
            <Select.ComboBox
              allowsEmptyCollection
              inputValue={query}
              isDisabled={isSubmitting}
              items={entityItems}
              label={t('label.search-entity', { entity: t('label.entity') })}
              size="sm"
              onInputChange={(text) => {
                setQuery(text);
                search(type, text);
              }}
              onSelectionChange={(key) => {
                const picked = hits.find((searchHit) => searchHit.id === key);
                if (!picked) {
                  return;
                }
                setEntity(picked);
                setQuery(getEntityName(picked));
                if (!isColumnTarget) {
                  void submit(picked);
                }
              }}>
              {(item) => (
                <Select.Item id={item.id} supportingText={item.supportingText}>
                  {item.label}
                </Select.Item>
              )}
            </Select.ComboBox>
          </div>
        )}
        {isColumnTarget && entity && (
          <Select
            data-testid="add-lineage-column-select"
            isDisabled={isSubmitting}
            items={columnItems}
            label={t('label.select-column')}
            size="sm"
            onSelectionChange={(key) => void submit(entity, String(key))}>
            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
          </Select>
        )}
      </div>
    </Popover>
  );
};

export default AddLineagePopover;

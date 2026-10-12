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
  Box,
  Button,
  Select,
  SelectItemType,
  SlideoutMenu,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowRight } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getNameFromFQN } from '../../../utils/FqnUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
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

const LineagePreviewCard = ({
  label,
  name,
  placeholder,
  isCurrent,
}: {
  label: string;
  name?: string;
  placeholder?: string;
  isCurrent?: boolean;
}) => (
  <Box
    className={
      isCurrent
        ? 'tw:min-w-0 tw:flex-1 tw:rounded-lg tw:border tw:border-brand tw:bg-brand-primary tw:px-3 tw:py-2'
        : 'tw:min-w-0 tw:flex-1 tw:rounded-lg tw:border tw:border-dashed tw:border-primary tw:bg-secondary tw:px-3 tw:py-2'
    }
    direction="col">
    <Typography className="tw:text-tertiary" size="text-xs">
      {label}
    </Typography>
    <Typography
      className={name ? 'tw:truncate tw:text-primary' : 'tw:text-quaternary'}
      size="text-sm"
      weight="medium">
      {name ?? placeholder}
    </Typography>
  </Box>
);

const joinNames = (...names: (string | undefined | false)[]) =>
  names.filter(Boolean).join('.') || undefined;

// Shows the edge about to be created, so the panel reads as a new input rather
// than another node on the canvas.
const LineageEdgePreview = ({
  isUpstream,
  currentName,
  pickedName,
}: {
  isUpstream: boolean;
  currentName?: string;
  pickedName?: string;
}) => {
  const { t } = useTranslation();
  const currentCard = (
    <LineagePreviewCard
      isCurrent
      label={t('label.current')}
      name={currentName}
    />
  );
  const pickedCard = (
    <LineagePreviewCard
      label={t('label.new-entity', {
        entity: t(isUpstream ? 'label.upstream' : 'label.downstream'),
      })}
      name={pickedName}
      placeholder={t('label.select-entity', { entity: t('label.asset') })}
    />
  );

  return (
    <Box
      align="center"
      aria-hidden="true"
      data-testid="add-lineage-preview"
      gap={2}>
      {isUpstream ? pickedCard : currentCard}
      <ArrowRight className="tw:size-4 tw:shrink-0 tw:text-fg-quaternary" />
      {isUpstream ? currentCard : pickedCard}
    </Box>
  );
};

const AddLineagePopover = ({
  request,
  nodeName,
  excludeEntityId,
  onClose,
  onSubmit,
}: AddLineagePopoverProps) => {
  const { t } = useTranslation();
  const [type, setType] = useState<SearchIndex>();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<EntityHit[]>([]);
  const [entity, setEntity] = useState<EntityHit>();
  const [columnFqn, setColumnFqn] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isColumnTarget = Boolean(request?.columnFqn);

  useEffect(() => {
    setType(undefined);
    setQuery('');
    setHits([]);
    setEntity(undefined);
    setColumnFqn(undefined);
  }, [request]);

  const search = useMemo(
    () =>
      debounce(async (index: SearchIndex, text: string) => {
        try {
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
        } catch (error) {
          showErrorToast(error as AxiosError);
        }
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
  const canSubmit = Boolean(entity && (!isColumnTarget || columnFqn));
  const currentName = joinNames(
    nodeName,
    request.columnFqn && getNameFromFQN(request.columnFqn)
  );
  const pickedName =
    entity &&
    joinNames(getEntityName(entity), columnFqn && getNameFromFQN(columnFqn));

  return (
    <SlideoutMenu
      isDismissable
      isOpen
      aria-label={t(isUpstream ? 'label.add-upstream' : 'label.add-downstream')}
      className="tw:z-1000"
      width={440}
      onOpenChange={(isPanelOpen) =>
        !isPanelOpen && !isSubmitting && onClose()
      }>
      {({ close }) => (
        <div
          className="tw:flex tw:size-full tw:flex-col"
          data-testid="add-lineage-popover">
          <SlideoutMenu.Header
            className="tw:border-b tw:border-secondary tw:pb-4"
            onClose={close}>
            <Typography as="h2" size="text-lg" weight="semibold">
              {t(isUpstream ? 'label.add-upstream' : 'label.add-downstream')}
            </Typography>
            <Typography className="tw:mt-1 tw:text-tertiary" size="text-sm">
              {t(
                isUpstream
                  ? 'message.add-upstream-lineage-description'
                  : 'message.add-downstream-lineage-description',
                { entity: currentName }
              )}
            </Typography>
          </SlideoutMenu.Header>
          <SlideoutMenu.Content className="tw:gap-5 tw:py-5">
            <LineageEdgePreview
              currentName={currentName}
              isUpstream={isUpstream}
              pickedName={pickedName}
            />
            <Select
              data-testid="add-lineage-type-select"
              items={typeItems}
              label={t('label.select-type')}
              selectedKey={type ?? null}
              size="sm"
              onSelectionChange={(key) => {
                // A search queued for the previous type must not refill the list.
                search.cancel();
                setType(key as SearchIndex);
                setQuery('');
                setEntity(undefined);
                setColumnFqn(undefined);
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
                  label={t('label.search-entity', {
                    entity: t('label.entity'),
                  })}
                  size="sm"
                  onInputChange={(text) => {
                    setQuery(text);
                    search(type, text);
                  }}
                  onSelectionChange={(key) => {
                    const picked = hits.find(
                      (searchHit) => searchHit.id === key
                    );
                    if (!picked) {
                      return;
                    }
                    setEntity(picked);
                    setColumnFqn(undefined);
                    setQuery(getEntityName(picked));
                  }}>
                  {(item) => (
                    <Select.Item
                      id={item.id}
                      supportingText={item.supportingText}>
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
                selectedKey={columnFqn ?? null}
                size="sm"
                onSelectionChange={(key) => setColumnFqn(String(key))}>
                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
              </Select>
            )}
          </SlideoutMenu.Content>
          <SlideoutMenu.Footer>
            <Box gap={3} justify="end">
              <Button
                color="secondary"
                data-testid="add-lineage-cancel"
                isDisabled={isSubmitting}
                onClick={close}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="add-lineage-submit"
                isDisabled={!canSubmit || isSubmitting}
                isLoading={isSubmitting}
                onClick={() => entity && void submit(entity, columnFqn)}>
                {t('label.add')}
              </Button>
            </Box>
          </SlideoutMenu.Footer>
        </div>
      )}
    </SlideoutMenu>
  );
};

export default AddLineagePopover;

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
  Card,
  CloseButton,
  FilterSelect,
  Select,
  SelectItemType,
  SlideoutMenu,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowRight } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { entityData } from '../../../constants/Lineage.constants';
import { EntityFields } from '../../../enums/AdvancedSearch.enum';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import {
  EdgeFromToData,
  LineageNodeType,
} from '../../../interface/lineage.interface';
import { getDataModelByFqn } from '../../../rest/dataModelsAPI';
import { getTableDetailsByFQN } from '../../../rest/tableAPI';
import { EntityIconSize } from '../../../utils/EntityIconUtils';
import { getEntityChildrenAndLabel } from '../../../utils/EntityLineageNodeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getCanonicalEntityType } from '../../../utils/ExplorePureUtils';
import { getAggregationOptions } from '../../../utils/ExploreUtils';
import { getNameFromFQN } from '../../../utils/FqnUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { getEntityTypeFromSearchIndex } from '../../../utils/SearchPureUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import DataAssetAsyncSelectList from '../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList';
import { DataAssetOption } from '../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import { AddLineagePopoverProps } from './AddLineagePopover.interface';
import { getCanvasColumnAssets } from './AddLineagePopover.utils';

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
  <Card
    className="tw:min-w-0 tw:flex-1"
    color={isCurrent ? 'brand' : 'default'}
    size="sm">
    <Card.Content>
      <Box direction="col">
        <Typography color="secondary" size="text-xs">
          {label}
        </Typography>
        <Typography
          color={name ? undefined : 'secondary'}
          ellipsis={Boolean(name)}
          size="text-sm"
          weight="medium">
          {name ?? placeholder}
        </Typography>
      </Box>
    </Card.Content>
  </Card>
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

// A column edit picks a node already on the canvas, then one of its columns.
const ColumnTargetFields = ({
  assetItems,
  columnItems,
  entityId,
  columnFqn,
  isDisabled,
  onAssetChange,
  onColumnChange,
}: {
  assetItems: SelectItemType[];
  columnItems: SelectItemType[];
  entityId?: string;
  columnFqn?: string;
  isDisabled: boolean;
  onAssetChange: (key: string | number | null) => void;
  onColumnChange: (columnFqn?: string) => void;
}) => {
  const { t } = useTranslation();

  return (
    <>
      <Select
        data-testid="add-lineage-canvas-asset-select"
        isDisabled={isDisabled}
        items={assetItems}
        label={t('label.select-entity', { entity: t('label.asset') })}
        placeholder={t('label.select-entity', { entity: t('label.asset') })}
        size="md"
        value={entityId ?? null}
        onChange={onAssetChange}>
        {(item) => (
          <Select.Item id={item.id} supportingText={item.supportingText}>
            {item.label}
          </Select.Item>
        )}
      </Select>
      {entityId && (
        <Select
          data-testid="add-lineage-column-select"
          isDisabled={isDisabled}
          items={columnItems}
          label={t('label.select-column')}
          size="md"
          value={columnFqn ?? null}
          onChange={(key) =>
            onColumnChange(key === null ? undefined : String(key))
          }>
          {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
        </Select>
      )}
    </>
  );
};

const AddLineagePopover = ({
  request,
  nodeName,
  excludeEntityId,
  canvasNodes,
  onClose,
  onSubmit,
}: AddLineagePopoverProps) => {
  const { t } = useTranslation();
  const [type, setType] = useState<SearchIndex>();
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [entity, setEntity] = useState<EntityHit>();
  const [columnFqn, setColumnFqn] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isColumnTarget = Boolean(request?.columnFqn);

  useEffect(() => {
    setType(undefined);
    setEntity(undefined);
    setColumnFqn(undefined);
  }, [request]);

  // Asset counts per type, as the Explore "Data Assets" filter shows them.
  useEffect(() => {
    // A column edit picks from the canvas, so it shows no type counts.
    if (!request || request.columnFqn) {
      return;
    }
    // One bucket per listed type; the default page of 10 drops the rest.
    getAggregationOptions(
      entityData.map(({ type: index }) => index),
      EntityFields.ENTITY_TYPE,
      '',
      '',
      true,
      false,
      entityData.length
    )
      .then((response) =>
        setTypeCounts(
          Object.fromEntries(
            (
              response.data.aggregations[`sterms#${EntityFields.ENTITY_TYPE}`]
                ?.buckets ?? []
            ).map(({ key, doc_count }) => [
              getCanonicalEntityType(key),
              doc_count,
            ])
          )
        )
      )
      .catch(() => setTypeCounts({}));
  }, [request]);

  // The search hit for the picked asset carries the columns to map to.
  // Columns come from the picked asset itself, fetched by FQN, so names shared
  // across services or special characters cannot miss it.
  const loadColumns = useCallback(async (picked: EntityHit) => {
    const fqn = picked.fullyQualifiedName ?? '';
    try {
      const { columns } =
        picked.entityType === EntityType.DASHBOARD_DATA_MODEL
          ? await getDataModelByFqn(fqn, { fields: TabSpecificField.COLUMNS })
          : await getTableDetailsByFQN(fqn, {
              fields: TabSpecificField.COLUMNS,
            });
      setEntity((current) =>
        current?.id === picked.id ? { ...current, columns } : current
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, []);

  const handleAssetChange = useCallback(
    (option?: DataAssetOption | DataAssetOption[]) => {
      const picked = Array.isArray(option) ? option[0] : option;
      setColumnFqn(undefined);
      if (!picked?.reference.id) {
        setEntity(undefined);

        return;
      }
      const hit: EntityHit = {
        id: picked.reference.id,
        name: picked.name,
        displayName: picked.displayName,
        fullyQualifiedName: picked.reference.fullyQualifiedName,
        entityType: picked.reference.type,
      };
      setEntity(hit);
    },
    []
  );

  const excludeQueryFilter = useMemo(
    () =>
      excludeEntityId
        ? { query: { bool: { must_not: [{ term: { id: excludeEntityId } }] } } }
        : undefined,
    [excludeEntityId]
  );

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

  // A column edit connects to another node already on the canvas, as dragging
  // between column handles did; only tables and data models carry columns.
  const canvasAssets = useMemo(
    () => getCanvasColumnAssets(canvasNodes, excludeEntityId),
    [canvasNodes, excludeEntityId]
  );

  const canvasAssetItems: SelectItemType[] = useMemo(
    () =>
      canvasAssets.map((asset) => ({
        id: asset.id,
        label: getEntityName(asset),
        supportingText: asset.fullyQualifiedName,
      })),
    [canvasAssets]
  );

  const handleCanvasAssetChange = useCallback(
    (key: string | number | null) => {
      const asset = canvasAssets.find(({ id }) => id === key);
      setColumnFqn(undefined);
      if (!asset) {
        setEntity(undefined);

        return;
      }
      const hit: EntityHit = {
        id: asset.id,
        name: asset.name,
        displayName: asset.displayName,
        fullyQualifiedName: asset.fullyQualifiedName,
        entityType: asset.entityType,
      };
      setEntity(hit);
      void loadColumns(hit);
    },
    [canvasAssets, loadColumns]
  );

  const typeOptions = useMemo(
    () =>
      entityData.map(({ type: index, label }) => {
        const entityType = getEntityTypeFromSearchIndex(index) ?? index;

        return {
          value: index,
          label: t(label),
          textValue: t(label),
          count: typeCounts[entityType],
          icon:
            searchClassBase.getEntityIconWithBg(
              entityType,
              EntityIconSize.Size14
            ) ?? undefined,
        };
      }),
    [t, typeCounts]
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
            showCloseButton={false}>
            <Box align="center" direction="row" justify="between">
              <Typography as="div" size="text-lg" weight="semibold">
                {t(isUpstream ? 'label.add-upstream' : 'label.add-downstream')}
              </Typography>
              <CloseButton size="sm" onClick={close} />
            </Box>
            <Typography
              className="tw:mt-1 tw:block"
              color="secondary"
              size="text-sm">
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
            {isColumnTarget ? (
              <ColumnTargetFields
                assetItems={canvasAssetItems}
                columnFqn={columnFqn}
                columnItems={columnItems}
                entityId={entity?.id}
                isDisabled={isSubmitting}
                onAssetChange={handleCanvasAssetChange}
                onColumnChange={setColumnFqn}
              />
            ) : (
              <>
                <Box className="tw:gap-1.5" direction="col">
                  <Typography
                    as="span"
                    className="tw:text-secondary"
                    size="text-sm"
                    weight="medium">
                    {t('label.select-type')}
                  </Typography>
                  <FilterSelect
                    searchable
                    commitMode="immediate"
                    data-testid="add-lineage-type-select"
                    hideCounts={false}
                    label={t('label.select-type')}
                    options={typeOptions}
                    placeholder={t('label.select-entity', {
                      entity: t('label.type'),
                    })}
                    popoverClassName="tw:w-(--trigger-width)!"
                    selectedValues={type ? [type] : []}
                    selectionMode="single"
                    size="md"
                    triggerVariant="input"
                    onChange={([value]) => {
                      setType(value as SearchIndex | undefined);
                      setEntity(undefined);
                      setColumnFqn(undefined);
                    }}
                  />
                </Box>
                {type && (
                  <Box
                    className="tw:gap-1.5"
                    data-testid="add-lineage-entity-input"
                    direction="col">
                    <Typography
                      as="span"
                      className="tw:text-secondary"
                      size="text-sm"
                      weight="medium">
                      {t('label.search-entity', { entity: t('label.asset') })}
                    </Typography>
                    <DataAssetAsyncSelectList
                      // A new type starts a fresh search.
                      key={type}
                      placeholder={t('label.search-entity', {
                        entity: t('label.asset'),
                      })}
                      queryFilter={excludeQueryFilter}
                      searchIndex={type}
                      value={entity?.fullyQualifiedName}
                      onChange={handleAssetChange}
                    />
                  </Box>
                )}
              </>
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

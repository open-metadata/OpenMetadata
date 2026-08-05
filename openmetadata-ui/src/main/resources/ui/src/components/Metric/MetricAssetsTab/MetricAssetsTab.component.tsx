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
  Alert,
  Box,
  Button,
  Checkbox,
  EmptyPlaceholder,
  Input,
  Select,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus, SearchLg, Trash01 } from '@untitledui/icons';
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import {
  AssetRollup,
  Direction,
} from '../../../generated/api/data/metricObservability';
import { Metric } from '../../../generated/entity/data/metric';
import { Operation } from '../../../generated/entity/policies/accessControl/resourcePermission';
import { Status } from '../../../generated/type/bulkOperationResult';
import { useMetricObservability } from '../../../hooks/useMetricObservability';
import { getEntityNameLabel } from '../../../utils/EntityNameUtils';
import MetricAssetAddDialog from './MetricAssetAddDialog';
import MetricAssetCard from './MetricAssetCard';
import MetricAssetResizableLayout from './MetricAssetResizableLayout';
import { getBulkFailureCount } from './MetricAssetsTab.utils';
import MetricAssetSummary from './MetricAssetSummary';
import { useMetricAssetsTab } from './useMetricAssetsTab';

export interface MetricAssetsTabProps {
  metric: Metric;
  permissions: OperationPermission;
  onAssetsChange?: () => void;
  onTotalAssetsChange?: (total: number) => void;
}

const DIRECTION_LABEL_KEYS: Record<Direction | 'all', string> = {
  all: 'label.all',
  [Direction.Upstream]: 'label.upstream',
  [Direction.Downstream]: 'label.downstream',
  [Direction.Unrelated]: 'label.unrelated',
};

const METRIC_ASSET_TYPES = [
  EntityType.TABLE,
  EntityType.TOPIC,
  EntityType.DASHBOARD,
  EntityType.PIPELINE,
  EntityType.MLMODEL,
  EntityType.CONTAINER,
  EntityType.SEARCH_INDEX,
  EntityType.STORED_PROCEDURE,
  EntityType.API_COLLECTION,
  EntityType.API_ENDPOINT,
];

const MetricAssetsTab: FC<MetricAssetsTabProps> = ({
  metric,
  permissions,
  onAssetsChange,
  onTotalAssetsChange,
}) => {
  const { t } = useTranslation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const metricFqn = metric.fullyQualifiedName ?? '';
  const state = useMetricAssetsTab({
    metricFqn,
    metricId: metric.id,
    onAssetsChange,
  });
  const observability = useMetricObservability(metric.id);
  const canEditRelationships =
    permissions[Operation.EditAll] ||
    permissions[Operation.EditEntityRelationship];
  const healthByAssetId = useMemo(
    () =>
      new Map<string, AssetRollup>(
        (observability.observability?.assets ?? []).map((rollup) => [
          rollup.asset.id,
          rollup,
        ])
      ),
    [observability.observability?.assets]
  );
  const activeRelation = state.pageAssets.find(
    ({ asset }) => asset.id === state.activeAssetId
  );
  const activeDetails = activeRelation
    ? state.detailsById.get(activeRelation.asset.id)
    : undefined;
  const existingAssetIds = useMemo(
    () => new Set(state.assets.map(({ asset }) => asset.id)),
    [state.assets]
  );
  const hasFilters =
    Boolean(state.filters.search.trim()) ||
    state.filters.direction !== 'all' ||
    state.filters.type !== 'all';

  const handleUnlink = async () => {
    try {
      await state.unlinkSelected();
    } catch {
      return;
    }
  };

  useEffect(() => {
    onTotalAssetsChange?.(state.totalAssets);
  }, [onTotalAssetsChange, state.totalAssets]);

  return (
    <Box
      aria-busy={state.isLoading}
      className="tw:flex tw:flex-col tw:gap-4 tw:px-4 tw:py-6 tw:md:px-8"
      data-testid="metric-assets-tab">
      <Box align="center" className="tw:flex-wrap" gap={3} justify="between">
        <Box className="tw:grid tw:min-w-0 tw:flex-1 tw:grid-cols-1 tw:gap-3 tw:md:grid-cols-[minmax(240px,1fr)_180px_180px]">
          <Input
            aria-label={t('label.search')}
            icon={SearchLg}
            inputDataTestId="metric-assets-search"
            placeholder={t('label.search-for-type', {
              type: t('label.asset-plural'),
            })}
            value={state.filters.search}
            onChange={(search) =>
              state.setFilters((current) => ({ ...current, search }))
            }
          />
          <Select
            aria-label={t('label.type')}
            data-testid="metric-assets-type-filter"
            value={state.filters.type}
            onChange={(type) =>
              state.setFilters((current) => ({
                ...current,
                type: String(type),
              }))
            }>
            <Select.Item id="all" label={t('label.all')} />
            {METRIC_ASSET_TYPES.map((type) => (
              <Select.Item
                id={type}
                key={type}
                label={getEntityNameLabel(type)}
              />
            ))}
          </Select>
          <Select
            aria-label={t('label.direction')}
            data-testid="metric-assets-direction-filter"
            value={state.filters.direction}
            onChange={(direction) =>
              state.setFilters((current) => ({
                ...current,
                direction: direction as Direction | 'all',
              }))
            }>
            {(['all', ...Object.values(Direction)] as const).map(
              (direction) => (
                <Select.Item
                  id={direction}
                  key={direction}
                  label={t(DIRECTION_LABEL_KEYS[direction])}
                />
              )
            )}
          </Select>
        </Box>
        {canEditRelationships && (
          <Button
            color="primary"
            data-testid="metric-assets-add"
            iconLeading={Plus}
            isDisabled={state.isRefetching}
            onPress={() => setIsAddDialogOpen(true)}>
            {t('label.add-entity', { entity: t('label.asset-plural') })}
          </Button>
        )}
      </Box>

      {state.bulkResult && (
        <Alert
          closable
          data-testid="metric-assets-bulk-result"
          title={
            state.bulkResult.status === Status.PartialSuccess
              ? t('label.partial-success')
              : t('label.success')
          }
          variant={
            getBulkFailureCount(state.bulkResult) > 0 ? 'warning' : 'success'
          }
          onClose={state.clearBulkResult}>
          {getBulkFailureCount(state.bulkResult) > 0
            ? `${getBulkFailureCount(state.bulkResult)} ${t('label.failed')}`
            : undefined}
        </Alert>
      )}
      {state.unlinkError && (
        <Alert
          title={t('server.entity-removing-error', {
            entity: t('label.asset-plural'),
          })}
          variant="error"
        />
      )}

      {canEditRelationships && state.pageAssets.length > 0 && (
        <Box
          align="center"
          className="tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:px-3 tw:py-2"
          gap={3}>
          <Checkbox
            aria-label={t('label.select-all')}
            isDisabled={state.isRefetching}
            isIndeterminate={
              state.selectedIds.size > 0 && !state.areAllPageAssetsSelected
            }
            isSelected={state.areAllPageAssetsSelected}
            onChange={state.togglePage}
          />
          <Typography className="tw:flex-1" size="text-sm" weight="medium">
            {state.selectedIds.size} {t('label.items-selected-lowercase')}
          </Typography>
          <Button
            color="secondary-destructive"
            data-testid="metric-assets-bulk-unlink"
            iconLeading={Trash01}
            isDisabled={
              state.selectedIds.size === 0 ||
              state.isRefetching ||
              state.isUnlinking
            }
            isLoading={state.isUnlinking}
            size="sm"
            onPress={handleUnlink}>
            {t('label.remove')}
          </Button>
        </Box>
      )}

      <Box
        className="tw:relative tw:min-h-80"
        data-testid="metric-assets-results">
        {state.isLoading || state.isRefetching ? (
          <Box className="tw:grid tw:grid-cols-1 tw:gap-3 tw:lg:grid-cols-2">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton height={138} key={index} variant="rounded" />
            ))}
          </Box>
        ) : state.error ? (
          <EmptyPlaceholder
            actions={[
              {
                key: 'retry',
                label: t('label.try-again'),
                onClick: () => state.refetch(),
              },
            ]}
            description={t('server.entity-fetch-error', {
              entity: t('label.asset-plural'),
            })}
            title={t('label.error')}
          />
        ) : state.totalAssets === 0 && !hasFilters ? (
          <EmptyPlaceholder
            actions={
              canEditRelationships
                ? [
                    {
                      key: 'add-assets',
                      label: t('label.add-entity', {
                        entity: t('label.asset-plural'),
                      }),
                      onClick: () => setIsAddDialogOpen(true),
                    },
                  ]
                : undefined
            }
            description={t('message.no-metric-assets')}
            title={t('label.no-data-found')}
          />
        ) : state.pageAssets.length === 0 ? (
          <EmptyPlaceholder
            description={t('message.no-data-available')}
            title={t('label.no-data-found')}
          />
        ) : (
          <MetricAssetResizableLayout
            isSummaryOpen={Boolean(activeRelation && activeDetails)}
            resizeLabel={t('label.resize-entity', {
              entity: t('label.summary'),
            })}
            summary={
              activeRelation && activeDetails ? (
                <MetricAssetSummary
                  details={activeDetails}
                  health={healthByAssetId.get(activeRelation.asset.id)}
                  isLoading={state.isActiveDetailsLoading}
                  metricFqn={metricFqn}
                  relation={activeRelation}
                  onClose={() => state.setActiveAssetId(undefined)}
                />
              ) : undefined
            }
            summaryLabel={t('label.summary')}
            onCloseSummary={() => state.setActiveAssetId(undefined)}>
            <Box direction="col" gap={3}>
              <ul
                aria-label={t('label.asset-plural')}
                className="tw:grid tw:list-none tw:grid-cols-1 tw:gap-3 tw:p-0 tw:lg:grid-cols-2">
                {state.pageAssets.map((relation) => (
                  <li key={relation.asset.id}>
                    <MetricAssetCard
                      details={
                        state.detailsById.get(relation.asset.id) ?? {
                          asset: relation.asset,
                          columns: [],
                          containment: [],
                          domains: [],
                          glossaryTerms: [],
                          owners: [],
                          tags: [],
                        }
                      }
                      hasDetailsError={state.detailErrorIds.has(
                        relation.asset.id
                      )}
                      health={healthByAssetId.get(relation.asset.id)}
                      isActive={state.activeAssetId === relation.asset.id}
                      isDetailsLoading={state.detailLoadingIds.has(
                        relation.asset.id
                      )}
                      isHealthLoading={observability.isPending}
                      isSelected={state.selectedIds.has(relation.asset.id)}
                      relation={relation}
                      showSelection={canEditRelationships}
                      onActivate={() =>
                        state.setActiveAssetId(relation.asset.id)
                      }
                      onRetryDetails={() =>
                        state.refetchAssetDetails(relation.asset.id)
                      }
                      onToggle={() => state.toggleAsset(relation)}
                    />
                  </li>
                ))}
              </ul>
              <Box align="center" justify="between">
                <Button
                  color="secondary"
                  isDisabled={state.page === 1}
                  size="sm"
                  onPress={() => state.setPage(state.page - 1)}>
                  {t('label.previous')}
                </Button>
                <Typography className="tw:text-tertiary" size="text-sm">
                  {t('label.page')} {state.page} / {state.totalPages}
                </Typography>
                <Button
                  color="secondary"
                  isDisabled={state.page === state.totalPages}
                  size="sm"
                  onPress={() => state.setPage(state.page + 1)}>
                  {t('label.next')}
                </Button>
              </Box>
            </Box>
          </MetricAssetResizableLayout>
        )}
      </Box>

      <MetricAssetAddDialog
        existingAssetIds={existingAssetIds}
        metricFqn={metricFqn}
        metricId={metric.id}
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onComplete={() => {
          state.refetch();
          onAssetsChange?.();
        }}
      />
    </Box>
  );
};

export default MetricAssetsTab;

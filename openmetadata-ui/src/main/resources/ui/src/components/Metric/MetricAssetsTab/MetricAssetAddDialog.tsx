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
  Badge,
  Box,
  Button,
  Checkbox,
  Dialog,
  EmptyPlaceholder,
  Input,
  Modal,
  ModalOverlay,
  Select,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { useMutation, useQuery } from '@tanstack/react-query';
import { SearchLg } from '@untitledui/icons';
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/type';
import { BulkOperationResult } from '../../../generated/type/bulkOperationResult';
import {
  addMetricTabAssets,
  getMetricTabAssets,
} from '../../../rest/metricTabsAPI';
import { searchQuery } from '../../../rest/searchAPI';
import {
  getEntityName,
  getEntityNameLabel,
} from '../../../utils/EntityNameUtils';
import {
  getBulkFailureCount,
  getBulkFailureIds,
  toEntityReference,
} from './MetricAssetsTab.utils';

const PAGE_SIZE = 10;

type MetricAssetDetailSearchIndex =
  | SearchIndex.API_COLLECTION
  | SearchIndex.API_ENDPOINT
  | SearchIndex.CONTAINER
  | SearchIndex.DASHBOARD
  | SearchIndex.MLMODEL
  | SearchIndex.PIPELINE
  | SearchIndex.SEARCH_INDEX
  | SearchIndex.STORED_PROCEDURE
  | SearchIndex.TABLE
  | SearchIndex.TOPIC;

type MetricAssetSearchIndex =
  | MetricAssetDetailSearchIndex
  | SearchIndex.DATA_ASSET;

const SEARCH_INDEX_LABELS: Record<MetricAssetSearchIndex, string> = {
  [SearchIndex.DATA_ASSET]: 'label.all',
  [SearchIndex.TABLE]: 'label.table-plural',
  [SearchIndex.TOPIC]: 'label.topic-plural',
  [SearchIndex.DASHBOARD]: 'label.dashboard-plural',
  [SearchIndex.PIPELINE]: 'label.pipeline-plural',
  [SearchIndex.MLMODEL]: 'label.ml-model-plural',
  [SearchIndex.CONTAINER]: 'label.container-plural',
  [SearchIndex.SEARCH_INDEX]: 'label.search-index-plural',
  [SearchIndex.STORED_PROCEDURE]: 'label.stored-procedure-plural',
  [SearchIndex.API_COLLECTION]: 'label.api-collection-plural',
  [SearchIndex.API_ENDPOINT]: 'label.api-endpoint-plural',
};

export const METRIC_ASSET_DETAIL_SEARCH_INDEXES: MetricAssetDetailSearchIndex[] =
  [
    SearchIndex.TABLE,
    SearchIndex.TOPIC,
    SearchIndex.DASHBOARD,
    SearchIndex.PIPELINE,
    SearchIndex.MLMODEL,
    SearchIndex.CONTAINER,
    SearchIndex.SEARCH_INDEX,
    SearchIndex.STORED_PROCEDURE,
    SearchIndex.API_COLLECTION,
    SearchIndex.API_ENDPOINT,
  ];

export const METRIC_ASSET_SEARCH_INDEXES: MetricAssetSearchIndex[] = [
  SearchIndex.DATA_ASSET,
  ...METRIC_ASSET_DETAIL_SEARCH_INDEXES,
];

export interface MetricAssetAddDialogProps {
  existingAssetIds: Set<string>;
  metricId: string;
  metricFqn: string;
  open: boolean;
  onClose: () => void;
  onComplete: (result: BulkOperationResult) => void;
}

const MetricAssetAddDialog: FC<MetricAssetAddDialogProps> = ({
  existingAssetIds,
  metricId,
  metricFqn,
  open,
  onClose,
  onComplete,
}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [searchIndex, setSearchIndex] = useState<MetricAssetSearchIndex>(
    SearchIndex.DATA_ASSET
  );
  const [selected, setSelected] = useState<Map<string, EntityReference>>(
    new Map()
  );
  const [bulkResult, setBulkResult] = useState<BulkOperationResult>();
  const [verifiedExistingIds, setVerifiedExistingIds] = useState<Set<string>>(
    new Set()
  );
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [linkedCheckError, setLinkedCheckError] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [search, searchIndex]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setPage(1);
      setSelected(new Map());
      setBulkResult(undefined);
      setVerifiedExistingIds(new Set());
      setCheckingIds(new Set());
      setLinkedCheckError(false);
    }
  }, [open]);

  const searchResult = useQuery({
    queryKey: ['metric-asset-search', searchIndex, search, page],
    queryFn: () =>
      searchQuery<
        MetricAssetSearchIndex[],
        | 'deleted'
        | 'description'
        | 'displayName'
        | 'entityType'
        | 'fullyQualifiedName'
        | 'name'
      >({
        fetchSource: true,
        includeFields: [
          'deleted',
          'description',
          'displayName',
          'entityType',
          'fullyQualifiedName',
          'name',
        ],
        includeDeleted: false,
        pageNumber: page,
        pageSize: PAGE_SIZE,
        query: search,
        searchIndex:
          searchIndex === SearchIndex.DATA_ASSET
            ? METRIC_ASSET_DETAIL_SEARCH_INDEXES
            : [searchIndex],
      }),
    enabled: open,
  });

  const options = useMemo(
    () =>
      (searchResult.data?.hits.hits ?? []).flatMap((hit) => {
        const reference = toEntityReference({
          ...hit._source,
          id: hit._id,
        });

        return reference && reference.type !== EntityType.METRIC
          ? [reference]
          : [];
      }),
    [searchResult.data]
  );
  const total = searchResult.data?.hits.total.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const addMutation = useMutation({
    mutationFn: () => addMetricTabAssets(metricFqn, [...selected.values()]),
    onSuccess: (result) => {
      const failureIds = getBulkFailureIds(result);
      const failureCount = getBulkFailureCount(result);
      setBulkResult(result);
      if (failureIds.size > 0) {
        setSelected(
          new Map([...selected].filter(([assetId]) => failureIds.has(assetId)))
        );
      } else if (failureCount === 0) {
        setSelected(new Map());
      }
      onComplete(result);
      if (failureCount === 0) {
        onClose();
      }
    },
  });

  const toggleAsset = async (asset: EntityReference) => {
    if (selected.has(asset.id)) {
      setSelected((current) => {
        const next = new Map(current);
        next.delete(asset.id);

        return next;
      });

      return;
    }
    if (existingAssetIds.has(asset.id) || verifiedExistingIds.has(asset.id)) {
      return;
    }

    setLinkedCheckError(false);
    setCheckingIds((current) => new Set(current).add(asset.id));
    try {
      const result = await getMetricTabAssets(metricId, {
        limit: PAGE_SIZE,
        offset: 0,
        q: asset.fullyQualifiedName ?? asset.name ?? asset.id,
      });
      const isAlreadyLinked = result.data.some(
        ({ asset: linkedAsset }) => linkedAsset.id === asset.id
      );
      if (isAlreadyLinked) {
        setVerifiedExistingIds((current) => new Set(current).add(asset.id));

        return;
      }

      setSelected((current) => new Map(current).set(asset.id, asset));
    } catch {
      setLinkedCheckError(true);
    } finally {
      setCheckingIds((current) => {
        const next = new Set(current);
        next.delete(asset.id);

        return next;
      });
    }
  };

  return (
    <ModalOverlay isDismissable isOpen={open} onOpenChange={onClose}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid="metric-asset-add-dialog"
          title={t('label.add-entity', { entity: t('label.asset-plural') })}
          width={720}
          onClose={onClose}>
          <Dialog.Content className="tw:max-h-[70vh]">
            <Box className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-[1fr_220px]">
              <Input
                aria-label={t('label.search')}
                icon={SearchLg}
                inputDataTestId="metric-asset-add-search"
                placeholder={t('label.search-for-type', {
                  type: t('label.asset-plural'),
                })}
                value={search}
                onChange={setSearch}
              />
              <Select
                aria-label={t('label.type')}
                data-testid="metric-asset-add-type"
                value={searchIndex}
                onChange={(value) =>
                  setSearchIndex(value as MetricAssetSearchIndex)
                }>
                {METRIC_ASSET_SEARCH_INDEXES.map((index) => (
                  <Select.Item
                    id={index}
                    key={index}
                    label={t(
                      SEARCH_INDEX_LABELS[index] ?? 'label.asset-plural'
                    )}
                  />
                ))}
              </Select>
            </Box>

            {bulkResult && getBulkFailureCount(bulkResult) > 0 && (
              <Alert
                data-testid="metric-asset-add-partial"
                title={t('label.partial-success')}
                variant="warning">
                {getBulkFailureCount(bulkResult)} {t('label.failed')}
              </Alert>
            )}
            {addMutation.error && (
              <Alert
                data-testid="metric-asset-add-error"
                title={t('label.error')}
                variant="error">
                {t('server.add-entity-error', {
                  entity: t('label.asset-plural'),
                })}
              </Alert>
            )}
            {linkedCheckError && (
              <Alert
                data-testid="metric-asset-linked-check-error"
                title={t('server.entity-fetch-error', {
                  entity: t('label.asset-plural'),
                })}
                variant="error"
              />
            )}

            <Box
              aria-busy={searchResult.isPending}
              aria-label={t('label.asset-plural')}
              className="tw:relative tw:min-h-64 tw:overflow-y-auto"
              role="list">
              {searchResult.isPending ? (
                <Box className="tw:flex tw:flex-col tw:gap-3">
                  {Array.from({ length: 5 }, (_, index) => (
                    <Skeleton height={56} key={index} variant="rounded" />
                  ))}
                </Box>
              ) : searchResult.error ? (
                <EmptyPlaceholder
                  actions={[
                    {
                      key: 'retry',
                      label: t('label.try-again'),
                      onClick: () => searchResult.refetch(),
                    },
                  ]}
                  description={t('server.entity-fetch-error', {
                    entity: t('label.asset-plural'),
                  })}
                  title={t('label.error')}
                />
              ) : options.length === 0 ? (
                <EmptyPlaceholder
                  description={t('message.no-data-available')}
                  title={t('label.no-data-found')}
                />
              ) : (
                <Box className="tw:flex tw:flex-col tw:gap-1">
                  {options.map((asset) => {
                    const isExisting =
                      existingAssetIds.has(asset.id) ||
                      verifiedExistingIds.has(asset.id);
                    const isChecking = checkingIds.has(asset.id);

                    return (
                      <Box
                        className="tw:flex tw:items-start tw:gap-3 tw:rounded-lg tw:px-3 tw:py-2 tw:hover:bg-primary_hover"
                        key={asset.id}
                        role="listitem">
                        <Checkbox
                          aria-label={getEntityName(asset)}
                          isDisabled={isExisting || isChecking}
                          isSelected={selected.has(asset.id)}
                          onChange={() => toggleAsset(asset)}
                        />
                        <Box className="tw:min-w-0 tw:flex-1" direction="col">
                          <Typography ellipsis size="text-sm" weight="medium">
                            {getEntityName(asset)}
                          </Typography>
                          <Typography
                            ellipsis
                            className="tw:text-tertiary"
                            size="text-xs">
                            {asset.fullyQualifiedName}
                          </Typography>
                        </Box>
                        <Badge color="gray" size="sm">
                          {isExisting
                            ? t('label.added')
                            : getEntityNameLabel(asset.type)}
                        </Badge>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>

            <Box align="center" justify="between">
              <Button
                color="secondary"
                isDisabled={page === 1 || searchResult.isFetching}
                size="sm"
                onPress={() => setPage((current) => current - 1)}>
                {t('label.previous')}
              </Button>
              <Typography className="tw:text-tertiary" size="text-sm">
                {t('label.page')} {page} / {totalPages}
              </Typography>
              <Button
                color="secondary"
                isDisabled={page === totalPages || searchResult.isFetching}
                size="sm"
                onPress={() => setPage((current) => current + 1)}>
                {t('label.next')}
              </Button>
            </Box>
          </Dialog.Content>
          <Dialog.Footer>
            <Button color="secondary" onPress={onClose}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="metric-asset-add-confirm"
              isDisabled={selected.size === 0 || addMutation.isPending}
              isLoading={addMutation.isPending}
              onPress={() => addMutation.mutate()}>
              {t('label.add-entity', { entity: t('label.asset-plural') })}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default MetricAssetAddDialog;

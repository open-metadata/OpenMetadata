/*
 *  Copyright 2025 Collate.
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
import { Alert, Box, Button, Checkbox } from '@openmetadata/ui-core-components';
import { Loading01 } from '@openmetadata/ui-core-components/icons';
import { isUndefined } from 'lodash';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../../enums/search.enum';
import NoDataPlaceholder from '../../common/EmptyPlaceholder/NoDataPlaceholder';
import Loader from '../../common/Loader/Loader';
import Searchbar from '../../common/SearchBarComponent/SearchBar.component';
import TableDataCardV2 from '../../common/TableDataCardV2/TableDataCardV2';
import ExploreQuickFilters from '../../Explore/ExploreQuickFilters';
import DomainAssetDryRunModal from '../DomainAssetDryRunModal/DomainAssetDryRunModal.component';
import { UseAssetSelectionStateReturn } from './useAssetSelectionState';

export interface AssetSelectionContentBodyProps
  extends Pick<
    UseAssetSelectionStateReturn,
    | 'assetsFilter'
    | 'search'
    | 'setSearch'
    | 'items'
    | 'failedStatus'
    | 'dryRunWarnings'
    | 'exportJob'
    | 'selectedItems'
    | 'isLoading'
    | 'isSaveLoading'
    | 'assetJobResponse'
    | 'aggregations'
    | 'quickFilterQuery'
    | 'filters'
    | 'totalCount'
    | 'handleCardClick'
    | 'confirmDomainAssetMove'
    | 'cancelDomainAssetMove'
    | 'onScroll'
    | 'onSelectAll'
    | 'getErrorStatusAndMessage'
    | 'handleQuickFiltersValueSelect'
    | 'clearFilters'
  > {
  emptyPlaceHolderText?: string;
  infoBannerText?: string;
}

type AssetSelectionHeaderProps = Pick<
  AssetSelectionContentBodyProps,
  | 'assetsFilter'
  | 'infoBannerText'
  | 'search'
  | 'setSearch'
  | 'failedStatus'
  | 'exportJob'
  | 'assetJobResponse'
  | 'aggregations'
  | 'quickFilterQuery'
  | 'filters'
  | 'handleQuickFiltersValueSelect'
  | 'clearFilters'
>;

const SpinnerIcon = ({ className }: { className?: string }) => (
  <Loading01 className={`${className ?? ''} tw:animate-spin`} />
);

const ValidationErrorAlert = () => {
  const { t } = useTranslation();
  const [isDismissed, setIsDismissed] = useState(false);

  return isDismissed ? null : (
    <Alert
      closable
      title={t('label.validation-error-plural')}
      variant="error"
      onClose={() => setIsDismissed(true)}>
      {t('message.validation-error-assets')}
    </Alert>
  );
};

const AssetSelectionHeader = ({
  infoBannerText,
  search,
  setSearch,
  failedStatus,
  exportJob,
  assetJobResponse,
  aggregations,
  quickFilterQuery,
  filters,
  handleQuickFiltersValueSelect,
  clearFilters,
  assetsFilter,
}: AssetSelectionHeaderProps) => {
  const { t } = useTranslation();

  return (
    <Box className="tw:shrink-0" direction="col" gap={4}>
      {(assetJobResponse || exportJob?.error) && (
        <Alert
          icon={isUndefined(exportJob?.error) ? SpinnerIcon : undefined}
          variant={exportJob?.error ? 'error' : 'success'}>
          {exportJob?.error ?? assetJobResponse?.message}
        </Alert>
      )}

      {infoBannerText && (
        <Alert data-testid="asset-selection-info-banner" variant="brand">
          {infoBannerText}
        </Alert>
      )}

      <Searchbar
        removeMargin
        showClearSearch
        placeholder={t('label.search-entity', {
          entity: t('label.asset-plural'),
        })}
        searchValue={search}
        onSearch={setSearch}
      />

      <Box align="center" data-testid="asset-filters" gap={4} justify="between">
        <ExploreQuickFilters
          untitledDropdown
          aggregations={aggregations}
          // The option counts of each filter follow the list: a port picker offers no columns.
          defaultQueryFilter={
            assetsFilter as Record<string, unknown> | undefined
          }
          fields={filters}
          index={SearchIndex.ALL}
          showDeleted={false}
          onFieldValueSelect={handleQuickFiltersValueSelect}
        />
        {quickFilterQuery && (
          <Button
            color="link-color"
            data-testid="clear-filters"
            size="sm"
            onClick={clearFilters}>
            {t('label.clear-entity', {
              entity: '',
            })}
          </Button>
        )}
      </Box>

      {failedStatus?.failedRequest && failedStatus.failedRequest.length > 0 && (
        <ValidationErrorAlert />
      )}
    </Box>
  );
};

type AssetSelectionListProps = Pick<
  AssetSelectionContentBodyProps,
  | 'emptyPlaceHolderText'
  | 'items'
  | 'selectedItems'
  | 'isLoading'
  | 'totalCount'
  | 'handleCardClick'
  | 'onScroll'
  | 'onSelectAll'
  | 'getErrorStatusAndMessage'
>;

const AssetSelectionList = ({
  emptyPlaceHolderText,
  items,
  selectedItems,
  isLoading,
  totalCount,
  handleCardClick,
  onScroll,
  onSelectAll,
  getErrorStatusAndMessage,
}: AssetSelectionListProps) => {
  const { t } = useTranslation();

  return (
    // p-1 keeps the cards' shadow inside the scroll container's clip.
    <Box
      className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:p-1"
      direction="col"
      gap={3}
      onScroll={onScroll}>
      {items.length > 0 && (
        // Non-scrolling wrapper: Card's overflow-hidden would otherwise let the scroll flex shrink it to 0.
        <Box direction="col" gap={3}>
          <Checkbox
            label={t('label.select-field', {
              field: t('label.all'),
            })}
            size="md"
            onChange={onSelectAll}
          />
          {items.map(({ _id, _source: item }) => (
            <TableDataCardV2
              openEntityInNewPage
              showCheckboxes
              checked={selectedItems?.has(item.id ?? '')}
              errorMessage={
                getErrorStatusAndMessage(item.id ?? '').errorMessage ??
                undefined
              }
              handleSummaryPanelDisplay={handleCardClick}
              id={`tabledatacard-${item.id}`}
              key={item.id ?? _id}
              showBody={false}
              showName={false}
              source={{ ...item, tags: [] }}
            />
          ))}
        </Box>
      )}

      {!isLoading && items.length === 0 && (
        <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
          <NoDataPlaceholder
            data-testid="no-data-placeholder"
            title={emptyPlaceHolderText}
          />
        </div>
      )}

      {isLoading && (items.length === 0 || items.length < totalCount) && (
        <Loader size="small" />
      )}
    </Box>
  );
};

const AssetSelectionContentBody = ({
  emptyPlaceHolderText,
  infoBannerText,
  search,
  setSearch,
  items,
  failedStatus,
  dryRunWarnings,
  exportJob,
  selectedItems,
  isLoading,
  isSaveLoading,
  assetJobResponse,
  aggregations,
  quickFilterQuery,
  filters,
  totalCount,
  handleCardClick,
  confirmDomainAssetMove,
  cancelDomainAssetMove,
  onScroll,
  onSelectAll,
  getErrorStatusAndMessage,
  handleQuickFiltersValueSelect,
  clearFilters,
  assetsFilter,
}: AssetSelectionContentBodyProps) => {
  const { t } = useTranslation();

  return (
    <Box
      className="tw:h-full tw:min-h-0 tw:w-full tw:overflow-hidden"
      direction="col"
      gap={4}>
      <AssetSelectionHeader
        aggregations={aggregations}
        assetJobResponse={assetJobResponse}
        assetsFilter={assetsFilter}
        clearFilters={clearFilters}
        exportJob={exportJob}
        failedStatus={failedStatus}
        filters={filters}
        handleQuickFiltersValueSelect={handleQuickFiltersValueSelect}
        infoBannerText={infoBannerText}
        quickFilterQuery={quickFilterQuery}
        search={search}
        setSearch={setSearch}
      />

      <AssetSelectionList
        emptyPlaceHolderText={emptyPlaceHolderText}
        getErrorStatusAndMessage={getErrorStatusAndMessage}
        handleCardClick={handleCardClick}
        isLoading={isLoading}
        items={items}
        selectedItems={selectedItems}
        totalCount={totalCount}
        onScroll={onScroll}
        onSelectAll={onSelectAll}
      />

      <DomainAssetDryRunModal
        confirmText={t('label.move-anyway')}
        header={t('label.confirm-asset-move')}
        isLoading={isSaveLoading}
        visible={!isUndefined(dryRunWarnings)}
        warnings={dryRunWarnings ?? []}
        warningsTestId="add-dry-run-warnings"
        onCancel={cancelDomainAssetMove}
        onConfirm={confirmDomainAssetMove}
      />
    </Box>
  );
};

export default AssetSelectionContentBody;

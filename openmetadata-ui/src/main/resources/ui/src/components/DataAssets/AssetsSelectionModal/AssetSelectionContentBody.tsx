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
import { ExclamationCircleOutlined } from '@ant-design/icons';
import {
  Box,
  Divider as CoreDivider,
  Typography,
} from '@openmetadata/ui-core-components';
import { Alert, Checkbox, List } from 'antd';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import VirtualList from 'rc-virtual-list';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../../enums/search.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import Banner from '../../common/Banner/Banner';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import Searchbar from '../../common/SearchBarComponent/SearchBar.component';
import TableDataCardV2 from '../../common/TableDataCardV2/TableDataCardV2';
import ExploreQuickFilters from '../../Explore/ExploreQuickFilters';
import DomainAssetDryRunModal from '../DomainAssetDryRunModal/DomainAssetDryRunModal.component';
import './asset-selection-model.style.less';
import { UseAssetSelectionStateReturn } from './useAssetSelectionState';

export interface AssetSelectionContentBodyProps
  extends Pick<
    UseAssetSelectionStateReturn,
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
}: AssetSelectionContentBodyProps) => {
  const { theme } = useApplicationStore();
  const { t } = useTranslation();

  return (
    <Box
      className="tw:h-full tw:min-h-0 tw:w-full tw:overflow-hidden"
      direction="col"
      gap={4}>
      <Box className="tw:shrink-0" direction="col" gap={4}>
        {(assetJobResponse || exportJob?.error) && (
          <Banner
            className="border-radius"
            isLoading={isUndefined(exportJob?.error)}
            message={exportJob?.error ?? assetJobResponse?.message ?? ''}
            type={exportJob?.error ? 'error' : 'success'}
          />
        )}

        {infoBannerText && (
          <Alert showIcon message={infoBannerText} type="info" />
        )}

        <div className="d-flex items-center gap-3">
          <div className="flex-1">
            <Searchbar
              removeMargin
              showClearSearch
              placeholder={t('label.search-entity', {
                entity: t('label.asset-plural'),
              })}
              searchValue={search}
              onSearch={setSearch}
            />
          </div>
        </div>

        <div className="asset-filters-wrapper">
          <ExploreQuickFilters
            untitledDropdown
            aggregations={aggregations}
            fields={filters}
            index={SearchIndex.ALL}
            showDeleted={false}
            onFieldValueSelect={handleQuickFiltersValueSelect}
          />
          {quickFilterQuery && (
            <Typography
              as="span"
              className="tw:text-brand-secondary tw:cursor-pointer"
              onClick={clearFilters}>
              {t('label.clear-entity', {
                entity: '',
              })}
            </Typography>
          )}
        </div>

        {failedStatus?.failedRequest &&
          failedStatus.failedRequest.length > 0 && (
            <Alert
              closable
              className="w-full"
              description={
                <Typography as="span" className="tw:text-tertiary">
                  {t('message.validation-error-assets')}
                </Typography>
              }
              message={
                <div className="d-flex items-center gap-3">
                  <ExclamationCircleOutlined
                    style={{
                      color: theme.errorColor,
                      fontSize: '24px',
                    }}
                  />
                  <Typography as="span" size="text-sm" weight="semibold">
                    {t('label.validation-error-plural')}
                  </Typography>
                </div>
              }
              type="error"
            />
          )}
      </Box>

      <Box
        className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto"
        direction="col"
        gap={4}
        onScroll={onScroll}>
        {items.length > 0 && (
          <div className="border p-xs asset-list-wrapper">
            <Checkbox
              className="assets-checkbox p-x-sm"
              onChange={(e) => onSelectAll(e.target.checked)}>
              {t('label.select-field', {
                field: t('label.all'),
              })}
            </Checkbox>
            <List>
              <VirtualList data={items} itemKey="id">
                {({ _source: item }) => {
                  const { isError, errorMessage } = getErrorStatusAndMessage(
                    item.id ?? ''
                  );

                  return (
                    <div
                      className={classNames({
                        'm-y-sm border-danger rounded-4': isError,
                      })}
                      key={item.id}>
                      <TableDataCardV2
                        openEntityInNewPage
                        showCheckboxes
                        checked={selectedItems?.has(item.id ?? '')}
                        className="border-none asset-selection-model-card cursor-pointer"
                        displayNameClassName="text-md"
                        handleSummaryPanelDisplay={handleCardClick}
                        id={`tabledatacard-${item.id}`}
                        key={item.id}
                        nameClassName="text-md"
                        showBody={false}
                        showName={false}
                        source={{ ...item, tags: [] }}
                      />
                      {isError && (
                        <>
                          <div className="p-x-sm">
                            <CoreDivider className="tw:mt-0 tw:my-2" />
                          </div>
                          <div className="d-flex gap-3 p-x-sm p-b-sm">
                            <ExclamationCircleOutlined
                              style={{
                                color: theme.errorColor,
                                fontSize: '24px',
                              }}
                            />
                            <Typography as="span" className="tw:break-all">
                              {errorMessage}
                            </Typography>
                          </div>
                        </>
                      )}
                    </div>
                  );
                }}
              </VirtualList>
            </List>
            {isLoading && items.length < totalCount && (
              <div className="d-flex justify-center p-y-sm">
                <Loader size="small" />
              </div>
            )}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <ErrorPlaceHolder>
            {emptyPlaceHolderText && (
              <Typography as="p">{emptyPlaceHolderText}</Typography>
            )}
          </ErrorPlaceHolder>
        )}

        {isLoading && items.length === 0 && <Loader size="small" />}
      </Box>

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

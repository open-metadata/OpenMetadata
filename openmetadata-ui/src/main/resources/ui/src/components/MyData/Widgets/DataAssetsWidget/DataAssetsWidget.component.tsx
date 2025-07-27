/*
 *  Copyright 2024 Collate.
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
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { Bucket } from 'Models';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DataAssetIcon } from '../../../../assets/svg/ic-data-assets.svg';
import { ReactComponent as NoDataAssetsPlaceholder } from '../../../../assets/svg/no-folder-data.svg';
import { ROUTES } from '../../../../constants/constants';
import {
  getSortField,
  getSortOrder,
} from '../../../../constants/Widgets.constant';
import { SIZE } from '../../../../enums/common.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { WidgetCommonProps } from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import { searchData } from '../../../../rest/miscAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import WidgetEmptyState from '../Common/WidgetEmptyState/WidgetEmptyState';
import WidgetFooter from '../Common/WidgetFooter/WidgetFooter';
import WidgetHeader from '../Common/WidgetHeader/WidgetHeader';
import WidgetWrapper from '../Common/WidgetWrapper/WidgetWrapper';
import './data-assets-widget.less';
import DataAssetCard from './DataAssetCard/DataAssetCard.component';
import {
  DATA_ASSETS_SORT_BY_KEYS,
  DATA_ASSETS_SORT_BY_OPTIONS,
} from './DataAssetsWidget.constants';

const DataAssetsWidget = ({
  isEditView = false,
  handleRemoveWidget,
  widgetKey,
  handleLayoutUpdate,
  currentLayout,
}: WidgetCommonProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<boolean>(true);
  const [services, setServices] = useState<Bucket[]>([]);
  const [selectedSortBy, setSelectedSortBy] = useState<string>(
    DATA_ASSETS_SORT_BY_KEYS.A_TO_Z
  );

  const widgetData = useMemo(
    () => currentLayout?.find((w) => w.i === widgetKey),
    [currentLayout, widgetKey]
  );

  const isFullSize = widgetData?.w === 2;

  const fetchDataAssets = useCallback(async () => {
    setLoading(true);
    try {
      const sortField = getSortField(selectedSortBy);
      const sortOrder = getSortOrder(selectedSortBy);
      const res = await searchData('', 0, 0, '', sortField, sortOrder, [
        SearchIndex.TABLE,
        SearchIndex.TOPIC,
        SearchIndex.DASHBOARD,
        SearchIndex.PIPELINE,
        SearchIndex.MLMODEL,
        SearchIndex.CONTAINER,
        SearchIndex.SEARCH_INDEX,
        SearchIndex.API_ENDPOINT_INDEX,
      ]);
      setServices(res?.data.aggregations?.['sterms#serviceType'].buckets);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDataAssets();
  }, [fetchDataAssets]);

  const handleSortByClick = useCallback(
    (key: string) => {
      setSelectedSortBy(key);
    },
    [setSelectedSortBy]
  );

  const sortedServices = useMemo(() => {
    switch (selectedSortBy) {
      case DATA_ASSETS_SORT_BY_KEYS.A_TO_Z:
        return [...services].sort((a, b) => a.key.localeCompare(b.key));
      case DATA_ASSETS_SORT_BY_KEYS.Z_TO_A:
        return [...services].sort((a, b) => b.key.localeCompare(a.key));
      default:
        return services;
    }
  }, [services, selectedSortBy]);

  const emptyState = useMemo(
    () => (
      <WidgetEmptyState
        icon={
          <NoDataAssetsPlaceholder height={SIZE.LARGE} width={SIZE.LARGE} />
        }
        title={t('message.no-data-assets-yet')}
      />
    ),
    [t]
  );

  const dataAssetsContent = useMemo(
    () => (
      <div className="entity-list-body">
        <div
          className={classNames(
            'cards-scroll-container flex-1 overflow-y-auto',
            isFullSize ? 'justify-start' : 'justify-center'
          )}>
          {sortedServices.map((service) => (
            <div
              className="card-wrapper"
              key={service.key}
              style={{
                width: isFullSize ? '125px' : '110px',
              }}>
              <DataAssetCard service={service} />
            </div>
          ))}
        </div>
      </div>
    ),
    [sortedServices, isFullSize]
  );

  const showWidgetFooterMoreButton = useMemo(
    () => Boolean(!loading) && services?.length > 10,
    [services, loading]
  );

  const widgetContent = useMemo(
    () => (
      <div className="data-assets-widget-container">
        <WidgetHeader
          currentLayout={currentLayout}
          handleLayoutUpdate={handleLayoutUpdate}
          handleRemoveWidget={handleRemoveWidget}
          icon={<DataAssetIcon height={24} width={24} />}
          isEditView={isEditView}
          selectedSortBy={selectedSortBy}
          sortOptions={DATA_ASSETS_SORT_BY_OPTIONS}
          title={t('label.data-asset-plural')}
          widgetKey={widgetKey}
          widgetWidth={widgetData?.w}
          onSortChange={handleSortByClick}
        />
        <div className="widget-content flex-1">
          {isEmpty(services) ? emptyState : dataAssetsContent}
          <WidgetFooter
            moreButtonLink={ROUTES.EXPLORE}
            moreButtonText={t('label.view-more')}
            showMoreButton={showWidgetFooterMoreButton}
          />
        </div>
      </div>
    ),
    [
      currentLayout,
      handleLayoutUpdate,
      handleRemoveWidget,
      isEditView,
      t,
      widgetKey,
      widgetData?.w,
      selectedSortBy,
      emptyState,
      dataAssetsContent,
      services,
    ]
  );

  return (
    <WidgetWrapper
      dataLength={services.length !== 0 ? services.length : 10}
      loading={loading}>
      {widgetContent}
    </WidgetWrapper>
  );
};

export default DataAssetsWidget;

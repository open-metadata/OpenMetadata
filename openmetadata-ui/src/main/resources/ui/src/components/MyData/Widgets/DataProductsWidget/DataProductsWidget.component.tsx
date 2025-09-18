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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as DataProductIcon } from '../../../../assets/svg/ic-data-product.svg';
import { ReactComponent as NoDataProductsPlaceholder } from '../../../../assets/svg/no-folder-data.svg';
import {
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
  ROUTES,
} from '../../../../constants/constants';
import {
  getSortField,
  getSortOrder,
} from '../../../../constants/Widgets.constant';
import { SIZE } from '../../../../enums/common.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { DataProduct } from '../../../../generated/entity/domains/dataProduct';
import { WidgetCommonProps } from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import { searchQuery } from '../../../../rest/searchAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import WidgetEmptyState from '../Common/WidgetEmptyState/WidgetEmptyState';
import WidgetFooter from '../Common/WidgetFooter/WidgetFooter';
import WidgetHeader from '../Common/WidgetHeader/WidgetHeader';
import WidgetWrapper from '../Common/WidgetWrapper/WidgetWrapper';
import './data-products-widget.less';
import DataProductCard from './DataProductCard/DataProductCard.component';
import {
  DATA_PRODUCTS_SORT_BY_KEYS,
  DATA_PRODUCTS_SORT_BY_OPTIONS,
} from './DataProductsWidget.constants';

const DataProductsWidget = ({
  isEditView = false,
  handleRemoveWidget,
  widgetKey,
  handleLayoutUpdate,
  currentLayout,
}: WidgetCommonProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [dataProducts, setDataProducts] = useState<DataProduct[]>([]);
  const [selectedSortBy, setSelectedSortBy] = useState<string>(
    DATA_PRODUCTS_SORT_BY_KEYS.A_TO_Z
  );

  const widgetData = useMemo(
    () => currentLayout?.find((w) => w.i === widgetKey),
    [currentLayout, widgetKey]
  );

  const isFullSize = widgetData?.w === 2;

  const fetchDataProducts = useCallback(async () => {
    setLoading(true);
    try {
      const sortField = getSortField(selectedSortBy);
      const sortOrder = getSortOrder(selectedSortBy);
      const res = await searchQuery({
        query: '',
        pageNumber: 1,
        pageSize: PAGE_SIZE_LARGE,
        searchIndex: SearchIndex.DATA_PRODUCT,
        sortField,
        sortOrder,
        queryFilter: {},
        fetchSource: true,
      });

      setDataProducts(res.hits.hits.map((hit) => hit._source) as DataProduct[]);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, [selectedSortBy]);

  useEffect(() => {
    fetchDataProducts();
  }, [fetchDataProducts]);

  const handleSortByClick = useCallback(
    (key: string) => {
      setSelectedSortBy(key);
    },
    [setSelectedSortBy]
  );

  const handleTitleClick = useCallback(() => {
    navigate(`${ROUTES.EXPLORE}?tab=data_product`);
  }, [navigate]);

  const sortedDataProducts = useMemo(() => {
    switch (selectedSortBy) {
      case DATA_PRODUCTS_SORT_BY_KEYS.A_TO_Z:
        return [...dataProducts].sort((a, b) =>
          (a.displayName || a.name).localeCompare(b.displayName || b.name)
        );
      case DATA_PRODUCTS_SORT_BY_KEYS.Z_TO_A:
        return [...dataProducts].sort((a, b) =>
          (b.displayName || b.name).localeCompare(a.displayName || a.name)
        );
      case DATA_PRODUCTS_SORT_BY_KEYS.HIGH_TO_LOW:
        return [...dataProducts].sort(
          (a, b) => (b.assets?.length || 0) - (a.assets?.length || 0)
        );
      case DATA_PRODUCTS_SORT_BY_KEYS.LOW_TO_HIGH:
        return [...dataProducts].sort(
          (a, b) => (a.assets?.length || 0) - (b.assets?.length || 0)
        );
      default:
        return dataProducts;
    }
  }, [dataProducts, selectedSortBy]);

  const emptyState = useMemo(
    () => (
      <WidgetEmptyState
        icon={
          <NoDataProductsPlaceholder height={SIZE.MEDIUM} width={SIZE.MEDIUM} />
        }
        title={t('message.no-data-products-yet')}
      />
    ),
    [t]
  );

  const dataProductsContent = useMemo(
    () => (
      <div className="entity-list-body">
        <div
          className={classNames(
            'cards-scroll-container flex-1 overflow-y-auto',
            isFullSize ? 'justify-start' : 'justify-center'
          )}>
          {sortedDataProducts.slice(0, PAGE_SIZE_MEDIUM).map((dataProduct) => (
            <div
              className="card-wrapper"
              key={dataProduct.id}
              style={{
                width: isFullSize ? '125px' : '110px',
              }}>
              <DataProductCard dataProduct={dataProduct} />
            </div>
          ))}
        </div>
      </div>
    ),
    [sortedDataProducts, isFullSize]
  );

  const showWidgetFooterMoreButton = useMemo(
    () => Boolean(!loading) && dataProducts?.length > PAGE_SIZE_MEDIUM,
    [dataProducts, loading]
  );

  const widgetHeader = useMemo(
    () => (
      <WidgetHeader
        currentLayout={currentLayout}
        handleLayoutUpdate={handleLayoutUpdate}
        handleRemoveWidget={handleRemoveWidget}
        icon={<DataProductIcon height={24} width={24} />}
        isEditView={isEditView}
        selectedSortBy={selectedSortBy}
        sortOptions={DATA_PRODUCTS_SORT_BY_OPTIONS}
        title={t('label.data-product-plural')}
        widgetKey={widgetKey}
        widgetWidth={widgetData?.w}
        onSortChange={handleSortByClick}
        onTitleClick={handleTitleClick}
      />
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
      handleSortByClick,
      handleTitleClick,
    ]
  );

  const widgetContent = useMemo(
    () => (
      <div className="data-products-widget-container">
        <div className="widget-content flex-1">
          {isEmpty(dataProducts) ? emptyState : dataProductsContent}
          <WidgetFooter
            moreButtonLink={`${ROUTES.EXPLORE}?tab=data_product`}
            moreButtonText={t('label.view-more')}
            showMoreButton={showWidgetFooterMoreButton}
          />
        </div>
      </div>
    ),
    [emptyState, dataProductsContent, showWidgetFooterMoreButton, t]
  );

  return (
    <WidgetWrapper
      dataTestId="KnowledgePanel.DataProducts"
      header={widgetHeader}
      loading={loading}>
      {widgetContent}
    </WidgetWrapper>
  );
};

export default DataProductsWidget;

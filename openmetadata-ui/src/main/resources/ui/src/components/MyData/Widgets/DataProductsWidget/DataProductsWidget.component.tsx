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
import { Button, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as DataProductIcon } from '../../../../assets/svg/ic-data-product-new.svg';
import { ReactComponent as DataProductNoDataPlaceholder } from '../../../../assets/svg/no-folder-data.svg';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
  PAGE_SIZE_MEDIUM,
  ROUTES,
} from '../../../../constants/constants';
import {
  applySortToData,
  getSortField,
  getSortOrder,
} from '../../../../constants/Widgets.constant';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../../enums/common.enum';
import { EntityType } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { DataProduct } from '../../../../generated/entity/domains/dataProduct';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import { getAllDataProductsWithAssetsCount } from '../../../../rest/dataProductAPI';
import { searchData } from '../../../../rest/miscAPI';
import { getEntityTypeExploreQueryFilter } from '../../../../utils/CommonUtils';
import { getDataProductIconByUrl } from '../../../../utils/DataProductUtils';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import WidgetEmptyState from '../Common/WidgetEmptyState/WidgetEmptyState';
import WidgetFooter from '../Common/WidgetFooter/WidgetFooter';
import WidgetHeader from '../Common/WidgetHeader/WidgetHeader';
import WidgetWrapper from '../Common/WidgetWrapper/WidgetWrapper';
import './data-products-widget.less';
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
  const [dataProducts, setDataProducts] = useState<DataProduct[]>([]);
  const navigate = useNavigate();
  const [selectedSortBy, setSelectedSortBy] = useState<string>(
    DATA_PRODUCTS_SORT_BY_KEYS.LATEST
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assetsCounts, setAssetsCounts] = useState<Record<string, number>>({});

  const fetchDataProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sortField = getSortField(selectedSortBy);
      const sortOrder = getSortOrder(selectedSortBy);

      const [res, counts] = await Promise.all([
        searchData(
          '',
          INITIAL_PAGING_VALUE,
          PAGE_SIZE_MEDIUM,
          '',
          sortField,
          sortOrder,
          SearchIndex.DATA_PRODUCT
        ),
        getAllDataProductsWithAssetsCount(),
      ]);

      const dataProducts = res?.data?.hits?.hits.map((hit) => hit._source);
      const sortedDataProducts = applySortToData(dataProducts, selectedSortBy);
      setDataProducts(sortedDataProducts as DataProduct[]);
      setAssetsCounts(counts);
    } catch {
      setError(t('message.fetch-data-product-list-error'));
      setDataProducts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSortBy, getSortField, getSortOrder, applySortToData]);

  const handleDataProductClick = useCallback(
    (dataProduct: DataProduct) => {
      navigate(
        getEntityDetailsPath(
          EntityType.DATA_PRODUCT,
          dataProduct.fullyQualifiedName ?? ''
        )
      );
    },
    [navigate]
  );

  const dataProductsWidget = useMemo(() => {
    const widget = currentLayout?.find(
      (widget: WidgetConfig) => widget.i === widgetKey
    );

    return widget;
  }, [currentLayout, widgetKey]);

  const isFullSize = useMemo(() => {
    return dataProductsWidget?.w === 2;
  }, [dataProductsWidget]);

  useEffect(() => {
    fetchDataProducts();
  }, [fetchDataProducts]);

  const handleSortByClick = useCallback((key: string) => {
    setSelectedSortBy(key);
  }, []);

  const handleTitleClick = useCallback(() => {
    navigate(`${ROUTES.EXPLORE}?tab=data_product`);
  }, [navigate]);

  const emptyState = useMemo(
    () => (
      <WidgetEmptyState
        description={t('message.data-products-no-data-message')}
        icon={
          <DataProductNoDataPlaceholder
            height={SIZE.MEDIUM}
            width={SIZE.MEDIUM}
          />
        }
        title={t('label.no-data-products-yet')}
      />
    ),
    [t]
  );

  const dataProductsList = useMemo(
    () => (
      <div className="entity-list-body">
        <div className="data-products-widget-grid">
          {dataProducts.slice(0, PAGE_SIZE_BASE).map((dataProduct) => (
            <Button
              className={classNames('data-product-card', {
                'data-product-card-full': isFullSize,
                'p-0': !isFullSize,
              })}
              data-testid={`data-product-card-${dataProduct.id}`}
              key={dataProduct.id}
              onClick={() => handleDataProductClick(dataProduct)}>
              {isFullSize ? (
                <div className="d-flex gap-2">
                  <div
                    className="data-product-card-full-icon"
                    data-testid="data-product-icon-container"
                    style={{ background: dataProduct.style?.color }}>
                    {getDataProductIconByUrl(dataProduct.style?.iconURL)}
                  </div>
                  <div className="data-product-card-full-content">
                    <div className="data-product-card-full-title-row">
                      <Typography.Text
                        className="font-semibold"
                        data-testid="data-product-name"
                        ellipsis={{
                          tooltip: true,
                        }}>
                        {dataProduct.displayName || dataProduct.name}
                      </Typography.Text>
                      <span
                        className="data-product-card-full-count"
                        data-testid="data-product-asset-count">
                        {assetsCounts[dataProduct.fullyQualifiedName ?? ''] ??
                          0}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="d-flex data-product-card-bar"
                  style={{ borderLeftColor: dataProduct.style?.color }}>
                  <div className="data-product-card-content">
                    <span className="data-product-card-title">
                      <div
                        className="data-product-card-icon"
                        data-testid="data-product-icon-container">
                        {getDataProductIconByUrl(dataProduct.style?.iconURL)}
                      </div>
                      <Typography.Text
                        className="data-product-card-name"
                        data-testid="data-product-name"
                        ellipsis={{ tooltip: true }}>
                        {dataProduct.displayName || dataProduct.name}
                      </Typography.Text>
                    </span>
                    <span
                      className="data-product-card-count"
                      data-testid="data-product-asset-count">
                      {assetsCounts[dataProduct.fullyQualifiedName ?? ''] ?? 0}
                    </span>
                  </div>
                </div>
              )}
            </Button>
          ))}
        </div>
      </div>
    ),
    [dataProducts, isFullSize]
  );

  const showWidgetFooterMoreButton = useMemo(
    () => Boolean(!loading) && dataProducts.length > PAGE_SIZE_BASE,
    [dataProducts, loading]
  );

  const footer = useMemo(() => {
    const quickFilter = encodeURIComponent(
      getEntityTypeExploreQueryFilter('dataproduct')
    );
    const exploreUrl = `${ROUTES.EXPLORE}?quickFilter=${quickFilter}`;

    return (
      <WidgetFooter
        moreButtonLink={exploreUrl}
        moreButtonText={t('label.view-more')}
        showMoreButton={showWidgetFooterMoreButton}
      />
    );
  }, [t, showWidgetFooterMoreButton]);

  const widgetHeader = useMemo(
    () => (
      <WidgetHeader
        currentLayout={currentLayout}
        handleLayoutUpdate={handleLayoutUpdate}
        handleRemoveWidget={handleRemoveWidget}
        icon={
          <DataProductIcon
            className="data-products-widget-icon"
            height={22}
            width={22}
          />
        }
        isEditView={isEditView}
        selectedSortBy={selectedSortBy}
        sortOptions={DATA_PRODUCTS_SORT_BY_OPTIONS}
        title={t('label.data-product-plural')}
        widgetKey={widgetKey}
        onSortChange={handleSortByClick}
        onTitleClick={handleTitleClick}
      />
    ),
    [
      currentLayout,
      handleLayoutUpdate,
      handleRemoveWidget,
      isEditView,
      selectedSortBy,
      t,
      widgetKey,
      handleSortByClick,
      handleTitleClick,
    ]
  );

  return (
    <WidgetWrapper
      dataTestId="KnowledgePanel.DataProducts"
      header={widgetHeader}
      loading={loading}>
      <div className="data-products-widget-container">
        <div className="widget-content flex-1">
          {error ? (
            <ErrorPlaceHolder
              className="data-products-widget-error border-none"
              type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
              {error}
            </ErrorPlaceHolder>
          ) : isEmpty(dataProducts) ? (
            <div data-testid="data-products-empty-state">{emptyState}</div>
          ) : (
            dataProductsList
          )}
        </div>
        {!isEmpty(dataProducts) && footer}
      </div>
    </WidgetWrapper>
  );
};

export default DataProductsWidget;

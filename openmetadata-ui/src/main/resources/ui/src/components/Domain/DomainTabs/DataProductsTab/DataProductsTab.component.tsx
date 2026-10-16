/*
 *  Copyright 2023 Collate.
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
import { Package, Plus } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import {
  forwardRef,
  lazy,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ENTITY_PATH } from '../../../../constants/constants';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../../../../constants/ResizablePanel.constants';
import { EntityType } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { DataProduct } from '../../../../generated/entity/domains/dataProduct';
import { usePaging } from '../../../../hooks/paging/usePaging';
import { useFqn } from '../../../../hooks/useFqn';
import { searchQuery } from '../../../../rest/searchAPI';
import { formatDataProductResponse } from '../../../../utils/APIUtils';
import { getQueryFilterForDataProducts } from '../../../../utils/DomainFilterUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import CreatePlaceholder from '../../../common/EmptyPlaceholder/CreatePlaceholder';
import Loader from '../../../common/Loader/Loader';
import NextPrevious from '../../../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../../common/NextPrevious/NextPrevious.interface';
import ResizablePanels from '../../../common/ResizablePanels/ResizablePanels';
import ExploreSearchCard from '../../../ExploreV1/ExploreSearchCard/ExploreSearchCard';
import { SourceType } from '../../../SearchedData/SearchedData.interface';
import { DataProductsTabProps } from './DataProductsTab.interface';

const EntitySummaryPanel = withSuspenseFallback(
  lazy(
    () =>
      import('../../../Explore/EntitySummaryPanel/EntitySummaryPanel.component')
  )
);

const DataProductsTab = forwardRef(
  ({ permissions, onAddDataProduct, domainFqn }: DataProductsTabProps, ref) => {
    const { t } = useTranslation();
    const { fqn: urlDomainFqn } = useFqn();
    const [dataProducts, setDataProducts] = useState<DataProduct[]>([]);

    const [selectedCard, setSelectedCard] = useState<DataProduct>();
    const [loading, setLoading] = useState(true);

    const {
      currentPage,
      pageSize,
      paging,
      handlePageChange,
      handlePageSizeChange,
      handlePagingChange,
    } = usePaging();

    const fetchDataProducts = useCallback(async () => {
      try {
        setLoading(true);
        const res = await searchQuery({
          query: '',
          pageNumber: currentPage,
          pageSize: pageSize,
          queryFilter: getQueryFilterForDataProducts(
            urlDomainFqn || domainFqn || ''
          ),
          searchIndex: SearchIndex.DATA_PRODUCT,
        });

        const data = formatDataProductResponse(res.hits.hits);
        setDataProducts(data);
        handlePagingChange({ total: res.hits.total.value ?? 0 });
        if (data.length > 0) {
          setSelectedCard(data[0]);
        }
      } catch (err) {
        showErrorToast(err as AxiosError);
        setDataProducts([]);
        handlePagingChange({ total: 0 });
      } finally {
        setLoading(false);
      }
    }, [currentPage, pageSize, urlDomainFqn, domainFqn, handlePagingChange]);

    const updateSelectedCard = useCallback((dataProductCard: SourceType) => {
      setSelectedCard(dataProductCard as DataProduct);
    }, []);

    useImperativeHandle(ref, () => ({
      refreshDataProducts() {
        handlePageChange(1);
        if (currentPage === 1) {
          fetchDataProducts();
        }
      },
    }));

    useEffect(() => {
      fetchDataProducts();
    }, [fetchDataProducts]);

    if (loading && isEmpty(dataProducts)) {
      return <Loader />;
    }

    if (isEmpty(dataProducts) && !loading) {
      return (
        <div className="tw:relative tw:min-h-70">
          <CreatePlaceholder
            actions={[
              {
                color: 'primary',
                iconLeading: Plus,
                id: 'data-product-add-button',
                key: 'add-data-product',
                label: t('label.add-entity', {
                  entity: t('label.data-product'),
                }),
                onPress: onAddDataProduct,
              },
            ]}
            description={t('label.no-data-products-yet-description')}
            icon={<Package className="tw:text-fg-brand-primary" />}
            permission={permissions.Create}
            title={t('label.no-data-products-yet')}
          />
        </div>
      );
    }

    return (
      <ResizablePanels
        className="h-full domain-height-with-resizable-panel"
        firstPanel={{
          className: 'domain-resizable-panel-container',
          children: (
            <>
              {dataProducts.map((dataProduct) => (
                <ExploreSearchCard
                  hideBreadcrumbs
                  className={classNames(
                    'm-b-sm cursor-pointer',
                    selectedCard?.id === dataProduct.id ? 'highlight-card' : ''
                  )}
                  handleSummaryPanelDisplay={updateSelectedCard}
                  id={dataProduct.id}
                  key={'data_products_card' + dataProduct.id}
                  showTags={false}
                  source={{
                    ...dataProduct,
                    entityType: EntityType.DATA_PRODUCT,
                  }}
                />
              ))}
              <NextPrevious
                isNumberBased
                currentPage={currentPage}
                isLoading={loading}
                pageSize={pageSize}
                paging={paging}
                pagingHandler={({ currentPage }: PagingHandlerParams) =>
                  handlePageChange(currentPage)
                }
                onShowSizeChange={handlePageSizeChange}
              />
            </>
          ),
          ...COMMON_RESIZABLE_PANEL_CONFIG.LEFT_PANEL,
        }}
        pageTitle={t('label.domain')}
        secondPanel={{
          wrapInCard: false,
          children: selectedCard && (
            <EntitySummaryPanel
              entityDetails={{
                details: {
                  ...selectedCard,
                  entityType: EntityType.DATA_PRODUCT,
                },
              }}
              handleClosePanel={() => setSelectedCard(undefined)}
              panelPath={ENTITY_PATH.dataProductsTab}
            />
          ),
          ...COMMON_RESIZABLE_PANEL_CONFIG.RIGHT_PANEL,
          className:
            'entity-summary-resizable-right-panel-container domain-resizable-panel-container',
        }}
      />
    );
  }
);

export default DataProductsTab;

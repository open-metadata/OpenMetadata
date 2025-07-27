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
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { PagingResponse } from 'Models';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_LARGE } from '../../../../constants/constants';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../../../../constants/ResizablePanel.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { EntityType } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { DataProduct } from '../../../../generated/entity/domains/dataProduct';
import { useFqn } from '../../../../hooks/useFqn';
import { searchData } from '../../../../rest/miscAPI';
import { formatDataProductResponse } from '../../../../utils/APIUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../../utils/StringsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../common/Loader/Loader';
import ResizablePanels from '../../../common/ResizablePanels/ResizablePanels';
import EntitySummaryPanel from '../../../Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import ExploreSearchCard from '../../../ExploreV1/ExploreSearchCard/ExploreSearchCard';
import { SourceType } from '../../../SearchedData/SearchedData.interface';
import { DataProductsTabProps } from './DataProductsTab.interface';

const DataProductsTab = forwardRef(
  ({ permissions, onAddDataProduct }: DataProductsTabProps, ref) => {
    const { t } = useTranslation();
    const { fqn: domainFqn } = useFqn();
    const [dataProducts, setDataProducts] = useState<
      PagingResponse<DataProduct[]>
    >({
      data: [],
      paging: { total: 0 },
    });

    const [selectedCard, setSelectedCard] = useState<DataProduct>();
    const [loading, setLoading] = useState(true);

    const fetchDataProducts = async () => {
      try {
        setLoading(true);
        const encodedFqn = getEncodedFqn(escapeESReservedCharacters(domainFqn));
        const res = await searchData(
          '',
          1,
          PAGE_SIZE_LARGE,
          `(domains.fullyQualifiedName:"${encodedFqn}")`,
          '',
          '',
          SearchIndex.DATA_PRODUCT
        );

        const data = formatDataProductResponse(res.data.hits.hits);
        setDataProducts({
          data: data,
          paging: { total: res.data.hits.total.value ?? 0 },
        });
        if (data.length > 0) {
          setSelectedCard(data[0]);
        }
      } catch (err) {
        showErrorToast(err as AxiosError);
        setDataProducts({
          data: [],
          paging: { total: 0 },
        });
      } finally {
        setLoading(false);
      }
    };

    const updateSelectedCard = useCallback((dataProductCard: SourceType) => {
      setSelectedCard(dataProductCard as DataProduct);
    }, []);

    useImperativeHandle(ref, () => ({
      refreshDataProducts() {
        fetchDataProducts();
      },
    }));

    useEffect(() => {
      fetchDataProducts();
    }, [domainFqn]);

    if (loading) {
      return <Loader />;
    }

    if (isEmpty(dataProducts.data) && !loading) {
      return (
        <ErrorPlaceHolder
          heading={t('label.data-product')}
          permission={permissions.Create}
          permissionValue={t('label.create-entity', {
            entity: t('label.data-product'),
          })}
          type={ERROR_PLACEHOLDER_TYPE.CREATE}
          onClick={onAddDataProduct}
        />
      );
    }

    return (
      <ResizablePanels
        className="h-full domain-height-with-resizable-panel"
        firstPanel={{
          className: 'domain-resizable-panel-container',
          children: (
            <>
              {dataProducts.data.map((dataProduct) => (
                <ExploreSearchCard
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

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
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { PagingResponse } from 'Models';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { PAGE_SIZE_LARGE } from '../../../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { EntityType } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { DataProduct } from '../../../../generated/entity/domains/dataProduct';
import { searchData } from '../../../../rest/miscAPI';
import { formatDataProductResponse } from '../../../../utils/APIUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import EntitySummaryPanel from '../../../Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import ExploreSearchCard from '../../../ExploreV1/ExploreSearchCard/ExploreSearchCard';
import Loader from '../../../Loader/Loader';
import PageLayoutV1 from '../../../PageLayoutV1/PageLayoutV1';
import { SourceType } from '../../../SearchedData/SearchedData.interface';
import { DataProductsTabProps } from './DataProductsTab.interface';

const DataProductsTab = forwardRef(
  ({ permissions, onAddDataProduct }: DataProductsTabProps, ref) => {
    const { t } = useTranslation();
    const { fqn: domainFqn } = useParams<{ fqn: string }>();
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
        const res = await searchData(
          '',
          1,
          PAGE_SIZE_LARGE,
          `(domain.fullyQualifiedName:${domainFqn})`,
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
      } catch (error) {
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
          className="m-t-xlg"
          heading={t('label.data-product')}
          permission={permissions.Create}
          type={ERROR_PLACEHOLDER_TYPE.CREATE}
          onClick={onAddDataProduct}
        />
      );
    }

    return (
      <PageLayoutV1
        className="domain-page-layout"
        pageTitle={t('label.domain')}
        rightPanel={
          selectedCard && (
            <EntitySummaryPanel
              entityDetails={{
                details: {
                  ...selectedCard,
                  entityType: EntityType.DATA_PRODUCT,
                },
              }}
              handleClosePanel={() => setSelectedCard(undefined)}
            />
          )
        }>
        <div className="p-x-md">
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
              source={{ ...dataProduct, entityType: EntityType.DATA_PRODUCT }}
            />
          ))}
        </div>
      </PageLayoutV1>
    );
  }
);

export default DataProductsTab;

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
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import EntitySummaryPanel from 'components/Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import ExploreSearchCard from 'components/ExploreV1/ExploreSearchCard/ExploreSearchCard';
import Loader from 'components/Loader/Loader';
import { SourceType } from 'components/searched-data/SearchedData.interface';
import { PAGE_SIZE_LARGE } from 'constants/constants';
import { GLOSSARIES_DOCS } from 'constants/docs.constants';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { EntityType } from 'enums/entity.enum';
import { DataProduct } from 'generated/entity/domains/dataProduct';
import { isEmpty } from 'lodash';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { getDataProductList } from 'rest/dataProductAPI';
import { showErrorToast } from 'utils/ToastUtils';
import { DataProductsTabProps } from './DataProductsTab.interface';

const DataProductsTab = forwardRef(
  ({ permissions, onAddDataProduct }: DataProductsTabProps, ref) => {
    const { t } = useTranslation();
    const { fqn: domainFqn } = useParams<{ fqn: string }>();
    const [dataProducts, setDataProducts] = useState<DataProduct[]>([]);
    const [selectedCard, setSelectedCard] = useState<DataProduct>();
    const [loading, setLoading] = useState(true);

    const fetchDataProductsList = useCallback(async () => {
      try {
        setLoading(true);
        const { data } = await getDataProductList({
          fields: 'domain,owner,experts',
          domain: domainFqn,
          limit: PAGE_SIZE_LARGE,
        });
        setDataProducts(data);
        if (data.length > 0) {
          setSelectedCard(data[0]);
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setLoading(false);
      }
    }, [domainFqn]);

    const updateSelectedCard = useCallback((dataProductCard: SourceType) => {
      setSelectedCard(dataProductCard as DataProduct);
    }, []);

    useImperativeHandle(ref, () => ({
      refreshDataProducts() {
        fetchDataProductsList();
      },
    }));

    useEffect(() => {
      fetchDataProductsList();
    }, [domainFqn]);

    if (loading) {
      return <Loader />;
    }

    if (isEmpty(dataProducts) && !loading) {
      return (
        <ErrorPlaceHolder
          className="m-t-xlg"
          doc={GLOSSARIES_DOCS}
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
          {dataProducts.map((dataProduct) => (
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

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

import { Avatar, Button, Typography } from '@openmetadata/ui-core-components';
import { Package, Plus } from '@openmetadata/ui-core-components/icons';
import { isEmpty, noop } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { INITIAL_PAGING_VALUE, ROUTES } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { SearchIndex } from '../../../enums/search.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { useMarketplaceStore } from '../../../hooks/useMarketplaceStore';
import { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { searchData } from '../../../rest/miscAPI';
import { getTextFromHtmlString } from '../../../utils/BlockEditorPureUtils';
import dataMarketplaceClassBase from '../../../utils/DataMarketplace/DataMarketplaceClassBase';
import { getEntityAvatarProps } from '../../../utils/IconUtils';
import { getEncodedFqn } from '../../../utils/StringUtils';
import CreatePlaceholder from '../../common/EmptyPlaceholder/CreatePlaceholder';
import Loader from '../../common/Loader/Loader';
import '../marketplace-widget-shared.less';
import MarketplaceItemCard from '../MarketplaceItemCard/MarketplaceItemCard.component';

const DISPLAY_COUNT = 3;

const MarketplaceDataProductsWidget = ({
  isEditView,
  dragHandle,
}: WidgetCommonProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { dataProductBasePath } = useMarketplaceStore();
  const { permissions } = usePermissionProvider();
  const [dataProducts, setDataProducts] = useState<DataProduct[]>(
    isEditView ? dataMarketplaceClassBase.getDummyDataProducts() : []
  );
  const [loading, setLoading] = useState(!isEditView);
  const [totalCount, setTotalCount] = useState(0);

  const fetchDataProducts = useCallback(async () => {
    if (isEditView) {
      return;
    }
    setLoading(true);
    try {
      const res = await searchData(
        '',
        INITIAL_PAGING_VALUE,
        DISPLAY_COUNT,
        '',
        'updatedAt',
        'desc',
        SearchIndex.DATA_PRODUCT
      );
      const products = res?.data?.hits?.hits.map(
        (hit) => hit._source
      ) as DataProduct[];
      setDataProducts(products ?? []);
      setTotalCount(res?.data?.hits?.total?.value ?? 0);
    } catch {
      setDataProducts([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [isEditView]);

  useEffect(() => {
    fetchDataProducts();
  }, [fetchDataProducts]);

  /** Creating goes through the Creation-gate page, where the playbook is enforced. */
  const openCreatePage = useCallback(
    () => navigate(ROUTES.ADD_DATA_PRODUCT),
    [navigate]
  );

  const handleClick = useCallback(
    (dp: DataProduct) => {
      if (isEditView) {
        return;
      }
      navigate(
        `${dataProductBasePath}/${getEncodedFqn(dp.fullyQualifiedName ?? '')}`,
        { state: { fromMarketplace: true } }
      );
    },
    [navigate, isEditView, dataProductBasePath]
  );

  const cardList = useMemo(
    () => (
      <div className="marketplace-widget-cards">
        {dataProducts.map((dp) => (
          <MarketplaceItemCard
            dataTestId={`marketplace-dp-card-${dp.id}`}
            icon={
              <Avatar
                size="md"
                {...getEntityAvatarProps({
                  ...dp,
                  entityType: 'dataProduct',
                })}
              />
            }
            key={dp.id}
            name={dp.displayName || dp.name}
            subtitle={getTextFromHtmlString(dp.description)}
            onClick={isEditView ? noop : () => handleClick(dp)}
          />
        ))}
      </div>
    ),
    [dataProducts, handleClick, isEditView]
  );

  if (loading) {
    return (
      <div
        className="marketplace-widget-section"
        data-testid="marketplace-dp-widget">
        <Loader size="small" />
      </div>
    );
  }

  return (
    <div
      className="marketplace-widget-section"
      data-testid="marketplace-dp-widget">
      <div className="marketplace-widget-header">
        <div>
          <Typography
            as="h5"
            className="marketplace-widget-title tw:text-text-primary tw:m-0"
            size="text-md"
            weight="semibold">
            {t('label.new')} {t('label.data-product-plural')}
          </Typography>
          <Typography
            as="span"
            className="tw:text-text-secondary"
            size="text-sm"
            weight="regular">
            {t('label.recently-created-entity', {
              entity: t('label.data-product-plural'),
            })}
          </Typography>
        </div>
        {dragHandle}
        {!isEditView && (
          <div className="marketplace-widget-actions">
            {permissions.dataProduct?.Create && (
              <Button
                color="secondary"
                data-testid="add-data-product-btn"
                onPress={openCreatePage}>
                + {t('label.add-entity', { entity: t('label.data-product') })}
              </Button>
            )}
            {totalCount > DISPLAY_COUNT && (
              <Link
                className="view-all-link"
                data-testid="view-all-data-products"
                to={dataProductBasePath}>
                {t('label.view-all')} &rarr;
              </Link>
            )}
          </div>
        )}
      </div>
      {isEmpty(dataProducts) ? (
        <div className="tw:relative tw:flex tw:min-h-60 tw:items-center tw:justify-center">
          <CreatePlaceholder
            actions={
              !isEditView && permissions.dataProduct?.Create
                ? [
                    {
                      key: 'add',
                      label: t('label.new-entity', {
                        entity: t('label.data-product'),
                      }),
                      color: 'primary',
                      iconLeading: Plus,
                      onPress: openCreatePage,
                    },
                  ]
                : undefined
            }
            data-testid="marketplace-dp-empty-state"
            description={t('label.no-data-products-yet-description')}
            icon={<Package className="tw:text-fg-brand-primary" />}
            title={t('label.no-data-products-yet')}
          />
        </div>
      ) : (
        cardList
      )}
    </div>
  );
};

export default MarketplaceDataProductsWidget;

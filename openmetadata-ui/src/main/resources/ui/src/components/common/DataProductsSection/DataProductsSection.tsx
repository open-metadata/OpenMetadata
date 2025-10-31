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
import { Typography } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as DataProductIcon } from '../../../assets/svg/ic-data-product.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { EntityReference } from '../../../generated/entity/type';
import { useEditableSection } from '../../../hooks/useEditableSection';
import { fetchDataProductsElasticSearch } from '../../../rest/dataProductAPI';
import { updateEntityField } from '../../../utils/EntityUpdateUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { DataProductsSelectListV1 } from '../../DataProducts/DataProductsSelectList/DataProductsSelectListV1';
import { EditIconButton } from '../IconButtons/EditIconButton';
import Loader from '../Loader/Loader';
import { DataProductsSectionProps } from './DataProductsSection.interface';
import './DataProductsSection.less';

const DataProductsSectionV1: React.FC<DataProductsSectionProps> = ({
  dataProducts = [],
  activeDomains = [],
  showEditButton = true,
  hasPermission = false,
  entityId,
  entityType,
  onDataProductsUpdate,
  maxVisibleDataProducts = 3,
}) => {
  const { t } = useTranslation();
  const [editingDataProducts, setEditingDataProducts] = useState<DataProduct[]>(
    []
  );
  const [showAllDataProducts, setShowAllDataProducts] = useState(false);
  const [displayActiveDomains, setDisplayActiveDomains] =
    useState<EntityReference[]>(activeDomains);

  const {
    isEditing,
    isLoading,
    popoverOpen,
    displayData: displayDataProducts,
    setDisplayData: setDisplayDataProducts,
    setIsLoading,
    setPopoverOpen,
    startEditing,
    cancelEditing,
    completeEditing,
  } = useEditableSection<EntityReference[]>(dataProducts);

  useEffect(() => {
    setDisplayActiveDomains((prev) => {
      const prevIds = prev
        .map((item) => item.id)
        .sort()
        .join(',');
      const newIds = activeDomains
        .map((item) => item.id)
        .sort()
        .join(',');

      if (prevIds !== newIds) {
        return activeDomains;
      }

      return prev;
    });
  }, [activeDomains]);

  const handleEditClick = () => {
    setEditingDataProducts(
      displayDataProducts.map((dp) => dp as unknown as DataProduct)
    );
    startEditing();
  };

  const fetchAPI = useCallback(
    async (searchValue: string, page = 1) => {
      const searchText = searchValue ?? '';
      const domainFQNs =
        displayActiveDomains?.map(
          (domain) => domain.fullyQualifiedName ?? ''
        ) ?? [];

      return fetchDataProductsElasticSearch(searchText, domainFQNs, page);
    },
    [displayActiveDomains]
  );

  const handleSaveWithDataProducts = useCallback(
    async (dataProductsToSave: DataProduct[]) => {
      setIsLoading(true);

      const updatedDataProducts: EntityReference[] = dataProductsToSave.map(
        (dp) => ({
          id: dp.id,
          fullyQualifiedName: dp.fullyQualifiedName,
          name: dp.name,
          displayName: dp.displayName,
          type: 'dataProduct',
        })
      );

      const result = await updateEntityField({
        entityId,
        entityType,
        fieldName: 'dataProducts',
        currentValue: displayDataProducts,
        newValue: updatedDataProducts,
        entityLabel: t('label.data-product-plural'),
        onSuccess: (dataProds) => {
          setDisplayDataProducts(dataProds);
          if (onDataProductsUpdate) {
            onDataProductsUpdate(dataProds);
          }
        },
        t,
      });

      if (result.success) {
        completeEditing();
      } else {
        setIsLoading(false);
      }
    },
    [
      entityId,
      entityType,
      displayDataProducts,
      onDataProductsUpdate,
      t,
      setDisplayDataProducts,
      setIsLoading,
      completeEditing,
    ]
  );

  const handlePopoverOpenChange = (open: boolean) => {
    setPopoverOpen(open);

    const dpList: DataProduct[] = displayDataProducts.map((dp) => ({
      id: dp.id,
      name: dp.name || '',
      displayName: dp.displayName || dp.name,
      fullyQualifiedName: dp.fullyQualifiedName || '',
      description: dp.description,
      type: 'dataProduct',
    })) as DataProduct[];

    setEditingDataProducts(dpList);
  };

  const editingState = useMemo(
    () => (
      <DataProductsSelectListV1
        fetchOptions={fetchAPI}
        popoverProps={{
          placement: 'bottomLeft',
          open: popoverOpen,
          onOpenChange: handlePopoverOpenChange,
        }}
        selectedDataProducts={editingDataProducts}
        onCancel={() => {
          setPopoverOpen(false);
          cancelEditing();
        }}
        onUpdate={handleSaveWithDataProducts}>
        <div className="data-product-selector-trigger" />
      </DataProductsSelectListV1>
    ),
    [
      fetchAPI,
      popoverOpen,
      handlePopoverOpenChange,
      editingDataProducts,
      handleSaveWithDataProducts,
      cancelEditing,
    ]
  );

  const emptyContent = useMemo(() => {
    if (isLoading) {
      return <Loader size="small" />;
    }
    if (isEditing) {
      return editingState;
    }

    if (!displayActiveDomains || displayActiveDomains.length === 0) {
      return (
        <Typography.Text className="text-sm text-grey-muted">
          {t('message.select-domain-to-add-data-product')}
        </Typography.Text>
      );
    }

    return (
      <span className="no-data-placeholder">{t('label.no-data-found')}</span>
    );
  }, [isLoading, isEditing, editingState, displayActiveDomains, t]);

  const dataProductsDisplay = useMemo(
    () => (
      <div className="data-products-display">
        <div className="data-products-list">
          {(showAllDataProducts
            ? displayDataProducts
            : displayDataProducts.slice(0, maxVisibleDataProducts)
          ).map((dataProduct) => (
            <div
              className="data-product-item"
              key={dataProduct.id || dataProduct.fullyQualifiedName}>
              <div className="data-product-card-bar">
                <div className="data-product-card-content">
                  <DataProductIcon className="data-product-icon" />
                  <span className="data-product-name">
                    {getEntityName(dataProduct)}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {displayDataProducts.length > maxVisibleDataProducts && (
            <button
              className="show-more-data-products-button"
              type="button"
              onClick={() => setShowAllDataProducts(!showAllDataProducts)}>
              {showAllDataProducts
                ? t('label.less')
                : `+${displayDataProducts.length - maxVisibleDataProducts} ${t(
                    'label.more-lowercase'
                  )}`}
            </button>
          )}
        </div>
      </div>
    ),
    [showAllDataProducts, displayDataProducts, maxVisibleDataProducts, t]
  );

  const dataProductsContent = useMemo(() => {
    if (isLoading) {
      return <Loader size="small" />;
    }
    if (isEditing) {
      return <div className="data-product-edit-wrapper">{editingState}</div>;
    }

    return dataProductsDisplay;
  }, [isLoading, isEditing, editingState, dataProductsDisplay]);

  const canShowEditButton =
    showEditButton &&
    hasPermission &&
    !isEditing &&
    !isLoading &&
    displayActiveDomains?.length > 0;

  if (!displayDataProducts?.length) {
    return (
      <div className="data-products-section">
        <div className="data-products-header">
          <Typography.Text className="data-products-title">
            {t('label.data-product-plural')}
          </Typography.Text>
          {canShowEditButton && (
            <EditIconButton
              newLook
              data-testid="edit-data-products"
              disabled={false}
              icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
              size="small"
              title={t('label.edit-entity', {
                entity: t('label.data-product-plural'),
              })}
              onClick={handleEditClick}
            />
          )}
        </div>
        <div className="data-products-content">{emptyContent}</div>
      </div>
    );
  }

  return (
    <div className="data-products-section">
      <div className="data-products-header">
        <Typography.Text className="data-products-title">
          {t('label.data-product-plural')}
        </Typography.Text>
        {showEditButton &&
          hasPermission &&
          !isEditing &&
          !isLoading &&
          displayActiveDomains &&
          displayActiveDomains.length > 0 && (
            <EditIconButton
              newLook
              data-testid="edit-data-products"
              disabled={false}
              icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
              size="small"
              title={t('label.edit-entity', {
                entity: t('label.data-product-plural'),
              })}
              onClick={handleEditClick}
            />
          )}
      </div>
      <div className="data-products-content">{dataProductsContent}</div>
    </div>
  );
};

export default DataProductsSectionV1;

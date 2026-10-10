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
import { Typography } from '@openmetadata/ui-core-components';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as DataProductIcon } from '../../../assets/svg/ic-data-product.svg';
import { DE_ACTIVE_COLOR, PAGE_SIZE_LARGE } from '../../../constants/constants';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { EntityReference } from '../../../generated/entity/type';
import { useEditableSection } from '../../../hooks/useEditableSection';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { fetchDataProductsElasticSearch } from '../../../rest/dataProductAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { updateEntityField } from '../../../utils/EntityUpdateUtils';
import DataProductsSelectList from '../../DataProducts/DataProductsSelectList/DataProductsSelectList';
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
  const [showAllDataProducts, setShowAllDataProducts] = useState(false);
  const [displayActiveDomains, setDisplayActiveDomains] =
    useState<EntityReference[]>(activeDomains);
  const { entityRules, isRulesLoaded } = useEntityRules(entityType);

  // Hold the strict domain-scoped behavior until the rules have actually loaded
  // (an empty rule set from the backend is indistinguishable from "not fetched
  // yet"), otherwise a cross-domain product could be selected before an enabled
  // rule resolves and then rejected by the backend on save.
  const requireDomainForDataProduct =
    !isRulesLoaded || entityRules.requireDomainForDataProduct;

  const {
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
        .sort((a, b) => (a ?? '').localeCompare(b ?? ''))
        .join(',');
      const newIds = activeDomains
        .map((item) => item.id)
        .sort((a, b) => (a ?? '').localeCompare(b ?? ''))
        .join(',');

      if (prevIds !== newIds) {
        return activeDomains;
      }

      return prev;
    });
  }, [activeDomains]);

  const handleEditClick = () => {
    startEditing();
  };

  const fetchAPI = useCallback(
    async (searchValue: string, page = 1) => {
      const searchText = searchValue ?? '';
      // When the "Data Product Domain Validation" rule is disabled, list Data
      // Products across all domains instead of scoping to the asset's domains.
      const domainFQNs = requireDomainForDataProduct
        ? displayActiveDomains?.map(
            (domain) => domain.fullyQualifiedName ?? ''
          ) ?? []
        : [];

      return fetchDataProductsElasticSearch(
        searchText,
        domainFQNs,
        page,
        PAGE_SIZE_LARGE
      );
    },
    [displayActiveDomains, requireDomainForDataProduct]
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
    if (!open) {
      cancelEditing();
    }
  };

  const emptyContent = useMemo(() => {
    if (isLoading) {
      return <Loader size="small" />;
    }
    if (
      requireDomainForDataProduct &&
      (!displayActiveDomains || displayActiveDomains.length === 0)
    ) {
      return (
        <Typography className="no-data-placeholder">
          {t('message.select-domain-to-add-data-product')}
        </Typography>
      );
    }

    return (
      <span className="no-data-placeholder">
        {t('label.no-entity-assigned', {
          entity: t('label.data-product-plural'),
        })}
      </span>
    );
  }, [isLoading, displayActiveDomains, requireDomainForDataProduct, t]);

  const dataProductsDisplay = useMemo(
    () => (
      <div className="data-products-display">
        <div className="data-products-list" data-testid="data-products-list">
          {(showAllDataProducts
            ? displayDataProducts
            : displayDataProducts.slice(0, maxVisibleDataProducts)
          ).map((dataProduct) => (
            <div
              className="data-product-item"
              data-testid="data-product-item"
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

    return dataProductsDisplay;
  }, [isLoading, dataProductsDisplay]);

  const canAssignDataProduct =
    displayActiveDomains?.length > 0 || !requireDomainForDataProduct;

  const canShowEditButton =
    showEditButton && hasPermission && !isLoading && canAssignDataProduct;

  // The picker opens from the edit button, like the glossary and tag pickers.
  const editButton = canShowEditButton && (
    <DataProductsSelectList
      fetchOptions={fetchAPI}
      isOpen={popoverOpen}
      multiple={isRulesLoaded && entityRules.canAddMultipleDataProducts}
      selectedDataProducts={displayDataProducts}
      onOpenChange={handlePopoverOpenChange}
      onSubmit={handleSaveWithDataProducts}>
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
    </DataProductsSelectList>
  );

  if (!displayDataProducts?.length) {
    return (
      <div className="data-products-section">
        <div className="data-products-header">
          <Typography className="data-products-title">
            {t('label.data-product-plural')}
          </Typography>
          {editButton}
        </div>
        <div className="data-products-content">{emptyContent}</div>
      </div>
    );
  }

  return (
    <div className="data-products-section">
      <div className="data-products-header">
        <Typography className="data-products-title">
          {t('label.data-product-plural')}
        </Typography>
        {editButton}
      </div>
      <div className="data-products-content">{dataProductsContent}</div>
    </div>
  );
};

export default DataProductsSectionV1;

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
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit.svg';
import { ReactComponent as DataProductIcon } from '../../../assets/svg/ic-data-product.svg';
import { EntityType } from '../../../enums/entity.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { EntityReference } from '../../../generated/entity/type';
import { patchChartDetails } from '../../../rest/chartsAPI';
import { patchDashboardDetails } from '../../../rest/dashboardAPI';
import { fetchDataProductsElasticSearch } from '../../../rest/dataProductAPI';
import { patchMlModelDetails } from '../../../rest/mlModelAPI';
import { patchPipelineDetails } from '../../../rest/pipelineAPI';
import { patchTableDetails } from '../../../rest/tableAPI';
import { patchTopicDetails } from '../../../rest/topicsAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import DataProductsSelectList from '../../DataProducts/DataProductsSelectList/DataProductsSelectList';
import './DataProductsSection.less';

interface DataProductsSectionProps {
  dataProducts?: EntityReference[];
  activeDomains?: EntityReference[];
  showEditButton?: boolean;
  hasPermission?: boolean;
  entityId?: string;
  entityType?: EntityType;
  onDataProductsUpdate?: (updatedDataProducts: EntityReference[]) => void;
  maxVisibleDataProducts?: number;
}

const DataProductsSection: React.FC<DataProductsSectionProps> = ({
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
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAllDataProducts, setShowAllDataProducts] = useState(false);

  // Function to get the correct patch API based on entity type
  const getPatchAPI = (entityType?: EntityType) => {
    switch (entityType) {
      case EntityType.TABLE:
        return patchTableDetails;
      case EntityType.DASHBOARD:
        return patchDashboardDetails;
      case EntityType.TOPIC:
        return patchTopicDetails;
      case EntityType.PIPELINE:
        return patchPipelineDetails;
      case EntityType.MLMODEL:
        return patchMlModelDetails;
      case EntityType.CHART:
        return patchChartDetails;
      default:
        // Default to table API for backward compatibility
        return patchTableDetails;
    }
  };

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const fetchAPI = useCallback(
    async (searchValue: string, page = 1) => {
      const searchText = searchValue ?? '';
      const domainFQNs =
        activeDomains?.map((domain) => domain.fullyQualifiedName ?? '') ?? [];

      return fetchDataProductsElasticSearch(searchText, domainFQNs, page);
    },
    [activeDomains]
  );

  const handleSaveWithDataProducts = useCallback(
    async (dataProductsToSave: DataProduct[]) => {
      const idToUse = entityId;

      if (!idToUse) {
        showErrorToast(t('message.entity-id-required'));

        return;
      }

      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          idToUse
        );

      if (!isUUID) {
        showErrorToast(t('message.invalid-entity-id'));

        return;
      }

      try {
        setIsLoading(true);

        // Convert DataProduct[] to EntityReference[] format
        const updatedDataProducts: EntityReference[] = dataProductsToSave.map(
          (dp) => ({
            id: dp.id,
            fullyQualifiedName: dp.fullyQualifiedName,
            name: dp.name,
            displayName: dp.displayName,
            type: 'dataProduct',
          })
        );

        // Create JSON patch by comparing the data products arrays
        const currentData = { dataProducts };
        const updatedData = { dataProducts: updatedDataProducts };
        const jsonPatch = compare(currentData, updatedData);

        // Only proceed if there are actual changes
        if (jsonPatch.length === 0) {
          setIsLoading(false);

          return;
        }

        // Make the API call using the correct patch API for the entity type
        const patchAPI = getPatchAPI(entityType);
        await patchAPI(idToUse, jsonPatch);

        // Show success message
        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.data-product-plural'),
          })
        );

        // Call the callback to update parent component with the new data products
        if (onDataProductsUpdate) {
          onDataProductsUpdate(updatedDataProducts);
        }

        // Keep loading state for a brief moment to ensure smooth transition
        setTimeout(() => {
          setIsEditing(false);
          setIsLoading(false);
        }, 500);
      } catch (error) {
        setIsLoading(false);
        showErrorToast(
          error as AxiosError,
          t('server.entity-updating-error', {
            entity: t('label.data-product-plural'),
          })
        );
      }
    },
    [entityId, dataProducts, onDataProductsUpdate, t]
  );

  const handleCancel = () => {
    setIsEditing(false);
  };

  const renderLoadingState = () => (
    <div className="data-products-loading-container">
      <div className="data-products-loading-spinner">
        <div className="loading-spinner" />
      </div>
    </div>
  );

  const renderEditingState = () => (
    <div className="inline-edit-container">
      <div className="data-products-selector">
        <DataProductsSelectList
          open
          defaultValue={(dataProducts || []).map(
            (item) => item?.fullyQualifiedName ?? ''
          )}
          fetchOptions={fetchAPI}
          mode="multiple"
          placeholder={t('label.data-product-plural')}
          onCancel={handleCancel}
          onSubmit={handleSaveWithDataProducts}
        />
      </div>
    </div>
  );

  const renderEmptyContent = () => {
    if (isLoading) {
      return renderLoadingState();
    }
    if (isEditing) {
      return renderEditingState();
    }

    // Show message if no domain is selected
    if (!activeDomains || activeDomains.length === 0) {
      return (
        <Typography.Text className="text-sm text-grey-muted">
          {t('message.select-domain-to-add-data-product')}
        </Typography.Text>
      );
    }

    return (
      <span className="no-data-placeholder">{t('label.no-data-found')}</span>
    );
  };

  const renderDataProductsDisplay = () => (
    <div className="data-products-display">
      <div className="data-products-list">
        {(showAllDataProducts
          ? dataProducts
          : dataProducts.slice(0, maxVisibleDataProducts)
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
        {dataProducts.length > maxVisibleDataProducts && (
          <button
            className="show-more-data-products-button"
            type="button"
            onClick={() => setShowAllDataProducts(!showAllDataProducts)}>
            {showAllDataProducts
              ? t('label.less')
              : `+${dataProducts.length - maxVisibleDataProducts} ${t(
                  'label.more-lowercase'
                )}`}
          </button>
        )}
      </div>
    </div>
  );

  const renderDataProductsContent = () => {
    if (isLoading) {
      return renderLoadingState();
    }
    if (isEditing) {
      return renderEditingState();
    }

    return renderDataProductsDisplay();
  };

  if (!dataProducts?.length) {
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
            activeDomains &&
            activeDomains.length > 0 && (
              <button
                className="edit-icon"
                type="button"
                onClick={handleEditClick}>
                <EditIcon />
              </button>
            )}
        </div>
        <div className="data-products-content">{renderEmptyContent()}</div>
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
          activeDomains &&
          activeDomains.length > 0 && (
            <button
              className="edit-icon"
              type="button"
              onClick={handleEditClick}>
              <EditIcon />
            </button>
          )}
      </div>
      <div className="data-products-content">{renderDataProductsContent()}</div>
    </div>
  );
};

export default DataProductsSection;

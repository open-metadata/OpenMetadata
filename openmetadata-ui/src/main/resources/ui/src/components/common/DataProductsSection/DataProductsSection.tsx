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
import { ReactComponent as CloseIcon } from '../../../assets/svg/close-icon.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit.svg';
import { ReactComponent as DataProductIcon } from '../../../assets/svg/ic-data-product.svg';
import { ReactComponent as TickIcon } from '../../../assets/svg/tick.svg';
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
}

const DataProductsSection: React.FC<DataProductsSectionProps> = ({
  dataProducts = [],
  activeDomains = [],
  showEditButton = true,
  hasPermission = false,
  entityId,
  entityType,
  onDataProductsUpdate,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editingDataProducts, setEditingDataProducts] = useState<DataProduct[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);

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
    // Convert EntityReference[] to DataProduct[] for editing
    const dataProductsForEditing = (dataProducts || []).map((dp) => ({
      id: dp?.id,
      fullyQualifiedName: dp?.fullyQualifiedName,
      name: dp?.name,
      displayName: dp?.displayName,
    })) as DataProduct[];
    setEditingDataProducts(dataProductsForEditing);
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

  const handleSave = () => {
    handleSaveWithDataProducts(editingDataProducts);
  };

  const handleCancel = () => {
    const dataProductsForEditing = (dataProducts || []).map((dp) => ({
      id: dp?.id,
      fullyQualifiedName: dp?.fullyQualifiedName,
      name: dp?.name,
      displayName: dp?.displayName,
    })) as DataProduct[];
    setEditingDataProducts(dataProductsForEditing);
    setIsEditing(false);
  };

  if (!dataProducts || !dataProducts.length) {
    return (
      <div className="data-products-section">
        <div className="data-products-header">
          <Typography.Text className="data-products-title">
            {t('label.data-product-plural')}
          </Typography.Text>
          {showEditButton && hasPermission && !isEditing && !isLoading && (
            <span className="cursor-pointer" onClick={handleEditClick}>
              <EditIcon />
            </span>
          )}
          {isEditing && !isLoading && (
            <div className="edit-actions">
              <span className="cursor-pointer" onClick={handleCancel}>
                <CloseIcon />
              </span>
              <span className="cursor-pointer" onClick={handleSave}>
                <TickIcon />
              </span>
            </div>
          )}
        </div>
        <div className="data-products-content">
          {isLoading ? (
            <div className="data-products-loading-container">
              <div className="data-products-loading-spinner">
                <div className="loading-spinner" />
              </div>
            </div>
          ) : isEditing ? (
            <div className="inline-edit-container">
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
          ) : (
            <span className="no-data-placeholder">
              {t('label.no-data-found')}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="data-products-section">
      <div className="data-products-header">
        <Typography.Text className="data-products-title">
          {t('label.data-product-plural')}
        </Typography.Text>
        {showEditButton && hasPermission && !isEditing && !isLoading && (
          <span className="cursor-pointer" onClick={handleEditClick}>
            <EditIcon />
          </span>
        )}
        {isEditing && !isLoading && (
          <div className="edit-actions">
            <span className="cursor-pointer" onClick={handleCancel}>
              <CloseIcon />
            </span>
            <span className="cursor-pointer" onClick={handleSave}>
              <TickIcon />
            </span>
          </div>
        )}
      </div>
      <div className="data-products-content">
        {isLoading ? (
          <div className="data-products-loading-container">
            <div className="data-products-loading-spinner">
              <div className="loading-spinner" />
            </div>
          </div>
        ) : isEditing ? (
          <div className="inline-edit-container">
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
        ) : (
          <div className="data-products-display">
            <div className="data-products-list">
              {(dataProducts || []).map((dataProduct, index) => (
                <div className="data-product-item" key={index}>
                  <DataProductIcon className="data-product-icon" />
                  <span className="data-product-name">
                    {getEntityName(dataProduct)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataProductsSection;

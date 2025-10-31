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
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as DataProductIcon } from '../../../assets/svg/ic-data-product.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { EntityReference } from '../../../generated/entity/type';
import { patchApiCollection } from '../../../rest/apiCollectionsAPI';
import { patchApiEndPoint } from '../../../rest/apiEndpointsAPI';
import { patchChartDetails } from '../../../rest/chartsAPI';
import { patchDashboardDetails } from '../../../rest/dashboardAPI';
import {
  patchDatabaseDetails,
  patchDatabaseSchemaDetails,
} from '../../../rest/databaseAPI';
import { patchDataModelDetails } from '../../../rest/dataModelsAPI';
import {
  fetchDataProductsElasticSearch,
  patchDataProduct,
} from '../../../rest/dataProductAPI';
import { patchMlModelDetails } from '../../../rest/mlModelAPI';
import { patchPipelineDetails } from '../../../rest/pipelineAPI';
import { patchSearchIndexDetails } from '../../../rest/SearchIndexAPI';
import { patchContainerDetails } from '../../../rest/storageAPI';
import { patchStoredProceduresDetails } from '../../../rest/storedProceduresAPI';
import { patchTableDetails } from '../../../rest/tableAPI';
import { patchTopicDetails } from '../../../rest/topicsAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { DataProductsSelectListV1 } from '../../DataProducts/DataProductsSelectList/DataProductsSelectListV1';
import { EditIconButton } from '../IconButtons/EditIconButton';
import Loader from '../Loader/Loader';
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
  const [isEditing, setIsEditing] = useState(false);
  const [editingDataProducts, setEditingDataProducts] = useState<DataProduct[]>(
    []
  );
  const [displayDataProducts, setDisplayDataProducts] =
    useState<EntityReference[]>(dataProducts);
  const [isLoading, setIsLoading] = useState(false);
  const [showAllDataProducts, setShowAllDataProducts] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [displayActiveDomains, setDisplayActiveDomains] =
    useState<EntityReference[]>(activeDomains);

  React.useEffect(() => {
    setDisplayDataProducts((prev) => {
      if (JSON.stringify(prev) !== JSON.stringify(dataProducts)) {
        return dataProducts;
      }

      return prev;
    });
  }, [dataProducts]);

  React.useEffect(() => {
    setDisplayActiveDomains((prev) => {
      if (JSON.stringify(prev) !== JSON.stringify(activeDomains)) {
        return activeDomains;
      }

      return prev;
    });
  }, [activeDomains]);

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
      case EntityType.API_COLLECTION:
        return patchApiCollection;
      case EntityType.API_ENDPOINT:
        return patchApiEndPoint;
      case EntityType.DATABASE:
        return patchDatabaseDetails;
      case EntityType.DATABASE_SCHEMA:
        return patchDatabaseSchemaDetails;
      case EntityType.STORED_PROCEDURE:
        return patchStoredProceduresDetails;
      case EntityType.CONTAINER:
        return patchContainerDetails;
      case EntityType.DASHBOARD_DATA_MODEL:
        return patchDataModelDetails;
      case EntityType.SEARCH_INDEX:
        return patchSearchIndexDetails;
      case EntityType.DATA_PRODUCT:
        return patchDataProduct;
      default:
        return patchTableDetails;
    }
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setPopoverOpen(true);
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
      const idToUse = entityId;

      if (!idToUse) {
        showErrorToast(t('message.entity-id-required'));

        return;
      }

      try {
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

        const currentData = { dataProducts: displayDataProducts };
        const updatedData = { dataProducts: updatedDataProducts };
        const jsonPatch = compare(currentData, updatedData);

        if (jsonPatch.length === 0) {
          setIsLoading(false);

          return;
        }

        const patchAPI = getPatchAPI(entityType);
        await patchAPI(idToUse, jsonPatch);

        setDisplayDataProducts(updatedDataProducts);

        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.data-product-plural'),
          })
        );

        if (onDataProductsUpdate) {
          onDataProductsUpdate(updatedDataProducts);
        }

        setIsEditing(false);
        setIsLoading(false);
        setPopoverOpen(false);
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
    [entityId, entityType, displayDataProducts, onDataProductsUpdate, t]
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

    if (!open) {
      setIsEditing(false);
    }
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
          setIsEditing(false);
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

  if (!displayDataProducts?.length) {
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

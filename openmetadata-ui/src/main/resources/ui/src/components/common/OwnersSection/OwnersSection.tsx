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
import { EntityType } from '../../../enums/entity.enum';
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
import { patchDataProduct } from '../../../rest/dataProductAPI';
import { patchMlModelDetails } from '../../../rest/mlModelAPI';
import { patchPipelineDetails } from '../../../rest/pipelineAPI';
import { patchSearchIndexDetails } from '../../../rest/SearchIndexAPI';
import { patchContainerDetails } from '../../../rest/storageAPI';
import { patchStoredProceduresDetails } from '../../../rest/storedProceduresAPI';
import { patchTableDetails } from '../../../rest/tableAPI';
import { patchTopicDetails } from '../../../rest/topicsAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { OwnerLabel } from '../OwnerLabel/OwnerLabel.component';
import { UserSelectableList } from '../UserSelectableList/UserSelectableList.component';
import './OwnersSection.less';

interface OwnersSectionProps {
  owners?: EntityReference[];
  showEditButton?: boolean;
  hasPermission?: boolean;
  entityId?: string;
  entityType?: EntityType;
  onOwnerUpdate?: (updatedOwners: EntityReference[]) => void;
}

const OwnersSection: React.FC<OwnersSectionProps> = ({
  owners = [],
  showEditButton = true,
  hasPermission = false,
  entityId,
  entityType,
  onOwnerUpdate,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editingOwners, setEditingOwners] = useState<EntityReference[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Function to get the appropriate patch API based on entity type
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
        // For entity types without specific patch APIs, throw an error
        throw new Error(
          `No patch API available for entity type: ${entityType}`
        );
    }
  };

  const handleEditClick = () => {
    setEditingOwners(owners);
    setIsEditing(true);
  };

  const handleSaveWithOwners = useCallback(
    async (ownersToSave: EntityReference[]) => {
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

        // Create JSON patch by comparing the owners arrays
        const currentData = { owners };
        const updatedData = { owners: ownersToSave };
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
            entity: t('label.owner-plural'),
          })
        );

        // Call the callback to update parent component with the new owners
        if (onOwnerUpdate) {
          onOwnerUpdate(ownersToSave);
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
            entity: t('label.owner-lowercase-plural'),
          })
        );
      }
    },
    [entityId, entityType, owners, onOwnerUpdate, t]
  );

  const handleCancel = () => {
    setEditingOwners(owners);
    setIsEditing(false);
  };

  const handleOwnerSelection = async (selectedOwners: EntityReference[]) => {
    setEditingOwners(selectedOwners);

    // Call API immediately like the existing system
    await handleSaveWithOwners(selectedOwners);
  };

  if (!owners.length) {
    return (
      <div className="owners-section">
        <div className="owners-header">
          <Typography.Text className="owners-title">
            {t('label.owner-plural')}
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
            </div>
          )}
        </div>
        <div className="owners-content">
          {isLoading ? (
            <div className="owners-loading-container">
              <div className="owners-loading-spinner">
                <div className="loading-spinner" />
              </div>
            </div>
          ) : isEditing ? (
            <div className="inline-edit-container">
              <UserSelectableList
                multiSelect
                hasPermission={hasPermission}
                popoverProps={{ placement: 'bottomLeft' }}
                selectedUsers={editingOwners}
                onUpdate={handleOwnerSelection}>
                <div className="owner-selector-display">
                  {editingOwners.length > 0 ? (
                    <div className="selected-owners-list">
                      {editingOwners.map((owner) => (
                        <div className="selected-owner-chip" key={owner.id}>
                          <span className="owner-name">
                            {owner.displayName || owner.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="owner-placeholder">
                      {t('label.select-entity', {
                        entity: t('label.owner-plural'),
                      })}
                    </span>
                  )}
                </div>
              </UserSelectableList>
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
    <div className="owners-section">
      <div className="owners-header">
        <Typography.Text className="owners-title">
          {t('label.owner-plural')}
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
          </div>
        )}
      </div>
      <div className="owners-content">
        {isLoading ? (
          <div className="owners-loading-container">
            <div className="owners-loading-spinner">
              <div className="loading-spinner" />
            </div>
          </div>
        ) : isEditing ? (
          <div className="inline-edit-container">
            <UserSelectableList
              multiSelect
              hasPermission={hasPermission}
              popoverProps={{ placement: 'bottomLeft' }}
              selectedUsers={editingOwners}
              onUpdate={handleOwnerSelection}>
              <div className="owner-selector-display">
                {editingOwners.length > 0 ? (
                  <div className="selected-owners-list">
                    {editingOwners.map((owner) => (
                      <div className="selected-owner-chip" key={owner.id}>
                        <span className="owner-name">
                          {owner.displayName || owner.name}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="owner-placeholder">
                    {t('label.select-entity', {
                      entity: t('label.owner-plural'),
                    })}
                  </span>
                )}
              </div>
            </UserSelectableList>
          </div>
        ) : (
          <div className="owners-display">
            <OwnerLabel
              avatarSize={19}
              className="owner-label-section"
              hasPermission={hasPermission}
              maxVisibleOwners={2}
              ownerLabelClassName="owner-label-container"
              owners={owners}
              showLabel={false}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnersSection;

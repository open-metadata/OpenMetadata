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
import { UserTeamSelectableList } from '../UserTeamSelectableList/UserTeamSelectableList.component';
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
  const [popoverOpen, setPopoverOpen] = useState(false);

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
    setPopoverOpen(true);
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
          setPopoverOpen(false);
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

  const handleOwnerSelection = async (selectedOwners?: EntityReference[]) => {
    const ownersToSave = selectedOwners ?? [];
    setEditingOwners(ownersToSave);

    // Call API immediately like the existing system
    await handleSaveWithOwners(ownersToSave);
  };

  const handlePopoverOpenChange = (open: boolean) => {
    setPopoverOpen(open);
    if (!open) {
      // When popover is closed, exit editing mode
      setIsEditing(false);
      setEditingOwners(owners);
    }
  };

  const renderLoadingState = () => (
    <div className="owners-loading-container">
      <div className="owners-loading-spinner">
        <div className="loading-spinner" />
      </div>
    </div>
  );

  const renderEditingState = () => (
    <div className="inline-edit-container">
      <UserTeamSelectableList
        hasPermission={hasPermission}
        multiple={{ user: true, team: true }}
        owner={editingOwners}
        popoverProps={{
          placement: 'bottomLeft',
          open: popoverOpen,
          onOpenChange: handlePopoverOpenChange,
        }}
        onClose={() => handlePopoverOpenChange(false)}
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
      </UserTeamSelectableList>
    </div>
  );

  const renderEmptyContent = () => {
    if (isLoading) {
      return renderLoadingState();
    }
    if (isEditing) {
      return renderEditingState();
    }

    return (
      <span className="no-data-placeholder">{t('label.no-data-found')}</span>
    );
  };

  const renderOwnersDisplay = () => (
    <div className="owners-display">
      <OwnerLabel
        avatarSize={24}
        className="owner-label-section"
        hasPermission={hasPermission}
        isCompactView={false}
        maxVisibleOwners={4}
        owners={owners}
        showLabel={false}
      />
    </div>
  );

  const renderOwnersContent = () => {
    if (isLoading) {
      return renderLoadingState();
    }
    if (isEditing) {
      return renderEditingState();
    }

    return renderOwnersDisplay();
  };

  if (!owners.length) {
    return (
      <div className="owners-section">
        <div className="owners-header">
          <Typography.Text className="owners-title">
            {t('label.owner-plural')}
          </Typography.Text>
          {showEditButton && hasPermission && !isEditing && !isLoading && (
            <span className="edit-icon" onClick={handleEditClick}>
              <EditIcon />
            </span>
          )}
        </div>
        <div className="owners-content">{renderEmptyContent()}</div>
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
          <span className="edit-icon" onClick={handleEditClick}>
            <EditIcon />
          </span>
        )}
      </div>
      <div className="owners-content">{renderOwnersContent()}</div>
    </div>
  );
};

export default OwnersSection;

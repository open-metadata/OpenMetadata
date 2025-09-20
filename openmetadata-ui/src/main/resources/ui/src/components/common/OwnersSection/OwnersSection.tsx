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
import { EntityReference } from '../../../generated/entity/type';
import { patchTableDetails } from '../../../rest/tableAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { OwnerLabel } from '../OwnerLabel/OwnerLabel.component';
import { UserSelectableList } from '../UserSelectableList/UserSelectableList.component';
import './OwnersSection.less';

interface OwnersSectionProps {
  owners?: EntityReference[];
  showEditButton?: boolean;
  hasPermission?: boolean;
  entityId?: string;
  onOwnerUpdate?: (updatedOwners: EntityReference[]) => void;
}

const OwnersSection: React.FC<OwnersSectionProps> = ({
  owners = [],
  showEditButton = true,
  hasPermission = false,
  entityId,
  onOwnerUpdate,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editingOwners, setEditingOwners] = useState<EntityReference[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

        // Make the API call
        await patchTableDetails(idToUse, jsonPatch);

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
    [entityId, owners, onOwnerUpdate, t]
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
          {showEditButton && !isEditing && !isLoading && (
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
        {showEditButton && !isEditing && !isLoading && (
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
              isCompactView
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

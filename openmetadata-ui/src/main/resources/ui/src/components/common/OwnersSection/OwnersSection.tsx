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
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../../assets/svg/close-icon.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit.svg';
import { ReactComponent as TickIcon } from '../../../assets/svg/tick.svg';
import { EntityReference } from '../../../generated/entity/type';
import { OwnerLabel } from '../OwnerLabel/OwnerLabel.component';
import { UserSelectableList } from '../UserSelectableList/UserSelectableList.component';
import './OwnersSection.less';
interface OwnersSectionProps {
  owners?: EntityReference[];
  showEditButton?: boolean;
  hasPermission?: boolean;
}

const OwnersSection: React.FC<OwnersSectionProps> = ({
  owners = [],
  showEditButton = true,
  hasPermission = false,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editingOwners, setEditingOwners] = useState<EntityReference[]>([]);

  const handleEditClick = () => {
    setEditingOwners(owners);
    setIsEditing(true);
  };

  const handleSave = () => {
    // TODO: Implement actual save functionality
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditingOwners(owners);
    setIsEditing(false);
  };

  const handleOwnerSelection = async (selectedOwners: EntityReference[]) => {
    setEditingOwners(selectedOwners);
  };

  if (!owners.length) {
    return (
      <div className="owners-section">
        <div className="owners-header">
          <Typography.Text className="owners-title">
            {t('label.owner-plural')}
          </Typography.Text>
          {showEditButton && !isEditing && (
            <span className="cursor-pointer" onClick={handleEditClick}>
              <EditIcon />
            </span>
          )}
          {isEditing && (
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
        <div className="owners-content">
          {isEditing ? (
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
        {showEditButton && !isEditing && (
          <span className="cursor-pointer" onClick={handleEditClick}>
            <EditIcon />
          </span>
        )}
        {isEditing && (
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
      <div className="owners-content">
        {isEditing ? (
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
              hasPermission={hasPermission}
              isCompactView={false}
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

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
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { useEditableSection } from '../../../hooks/useEditableSection';
import { updateEntityField } from '../../../utils/EntityUpdateUtils';
import { EditIconButton } from '../IconButtons/EditIconButton';
import Loader from '../Loader/Loader';
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
  const [editingOwners, setEditingOwners] = useState<EntityReference[]>([]);

  const {
    isEditing,
    isLoading,
    popoverOpen,
    displayData: displayOwners,
    setDisplayData: setDisplayOwners,
    setIsLoading,
    setPopoverOpen,
    startEditing,
    completeEditing,
  } = useEditableSection<EntityReference[]>(owners);

  const handleEditClick = () => {
    setEditingOwners(displayOwners);
    startEditing();
  };

  const handleSaveWithOwners = useCallback(
    async (ownersToSave: EntityReference[]) => {
      setIsLoading(true);

      const result = await updateEntityField({
        entityId,
        entityType,
        fieldName: 'owners',
        currentValue: displayOwners,
        newValue: ownersToSave,
        entityLabel: t('label.owner-plural'),
        onSuccess: (owners) => {
          setDisplayOwners(owners);
          if (onOwnerUpdate) {
            onOwnerUpdate(owners);
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
      displayOwners,
      onOwnerUpdate,
      t,
      setDisplayOwners,
      setIsLoading,
      completeEditing,
    ]
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
      setEditingOwners(displayOwners);
    }
  };

  const editingState = useMemo(
    () => (
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
          {editingOwners.length > 0 && (
            <div className="selected-owners-list">
              {editingOwners.map((owner) => (
                <div className="selected-owner-chip" key={owner.id}>
                  <span className="owner-name">
                    {owner.displayName || owner.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </UserTeamSelectableList>
    ),
    [
      hasPermission,
      editingOwners,
      popoverOpen,
      handlePopoverOpenChange,
      handleOwnerSelection,
    ]
  );

  const emptyContent = useMemo(() => {
    if (isLoading) {
      return <Loader size="small" />;
    }
    if (isEditing) {
      return editingState;
    }

    return (
      <span className="no-data-placeholder">{t('label.no-data-found')}</span>
    );
  }, [isLoading, isEditing, editingState, t]);

  const ownersDisplay = useMemo(
    () => (
      <div className="owners-display">
        <OwnerLabel
          avatarSize={24}
          className="owner-label-section"
          hasPermission={hasPermission}
          isCompactView={false}
          maxVisibleOwners={4}
          owners={displayOwners}
          showLabel={false}
        />
      </div>
    ),
    [hasPermission, displayOwners]
  );

  const ownersContent = useMemo(() => {
    if (isLoading) {
      return <Loader size="small" />;
    }
    if (isEditing) {
      return editingState;
    }

    return ownersDisplay;
  }, [isLoading, isEditing, editingState, ownersDisplay]);

  if (!displayOwners.length) {
    return (
      <div className="owners-section">
        <div className="owners-header">
          <Typography.Text className="owners-title">
            {t('label.owner-plural')}
          </Typography.Text>
          {showEditButton && hasPermission && !isEditing && !isLoading && (
            <EditIconButton
              newLook
              data-testid="edit-owners"
              disabled={false}
              icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
              size="small"
              title={t('label.edit-entity', {
                entity: t('label.owner-plural'),
              })}
              onClick={handleEditClick}
            />
          )}
        </div>
        <div className="owners-content">{emptyContent}</div>
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
          <EditIconButton
            newLook
            data-testid="edit-owners"
            disabled={false}
            icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
            size="small"
            title={t('label.edit-entity', {
              entity: t('label.owner-plural'),
            })}
            onClick={handleEditClick}
          />
        )}
      </div>
      <div className="owners-content">{ownersContent}</div>
    </div>
  );
};

export default OwnersSection;

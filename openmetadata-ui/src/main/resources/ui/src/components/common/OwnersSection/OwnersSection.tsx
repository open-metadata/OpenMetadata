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
import { Box, Typography, useTheme } from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/type';
import { useEditableSection } from '../../../hooks/useEditableSection';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { updateEntityField } from '../../../utils/EntityUpdateUtils';
import { EditIconButton } from '../IconButtons/EditIconButton';
import Loader from '../Loader/Loader';
import { OwnerLabel } from '../OwnerLabel/OwnerLabel.component';
import { UserTeamSelectableList } from '../UserTeamSelectableList/UserTeamSelectableList.component';
import { OwnersSectionProps } from './OwnersSection.interface';

const OwnersSection: React.FC<OwnersSectionProps> = ({
  owners = [],
  showEditButton = true,
  hasPermission = false,
  entityId,
  entityType,
  onOwnerUpdate,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [editingOwners, setEditingOwners] = useState<EntityReference[]>([]);
  const { entityRules } = useEntityRules(entityType);
  const {
    isEditing,
    isLoading,
    popoverOpen,
    displayData: displayOwners,
    setDisplayData: setDisplayOwners,
    setIsLoading,
    setPopoverOpen,
    startEditing,
    cancelEditing,
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
          onOwnerUpdate?.(owners);
          completeEditing();
        },
        t,
      });

      if (result.success && result.data === displayOwners) {
        completeEditing();
      } else if (!result.success) {
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
      cancelEditing();
    }
  };

  const editingState = useMemo(
    () => (
      <UserTeamSelectableList
        hasPermission={hasPermission}
        multiple={{
          user: entityRules.canAddMultipleUserOwners,
          team: entityRules.canAddMultipleTeamOwner,
        }}
        owner={editingOwners}
        popoverProps={{
          placement: 'bottomLeft',
          open: popoverOpen,
          onOpenChange: handlePopoverOpenChange,
        }}
        onClose={() => {
          handlePopoverOpenChange(false);
          cancelEditing();
        }}
        onUpdate={handleOwnerSelection}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}>
          {editingOwners.length > 0 && (
            <Box sx={{ display: 'none' }}>
              {editingOwners.map((owner) => (
                <Box key={owner.id}>
                  <Box
                    component="span"
                    sx={{
                      fontWeight: 500,
                      fontSize: '12px',
                      color: '#21263c',
                    }}>
                    {owner.displayName || owner.name}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </UserTeamSelectableList>
    ),
    [
      hasPermission,
      editingOwners,
      popoverOpen,
      handlePopoverOpenChange,
      handleOwnerSelection,
      entityRules,
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
      <Box
        component="span"
        sx={{
          color: (theme) => theme.palette.allShades.gray[500],
          fontSize: '12px',
        }}>
        {t('label.no-entity-assigned', {
          entity: t('label.owner-plural'),
        })}
      </Box>
    );
  }, [isLoading, isEditing, editingState, t]);

  const ownersDisplay = useMemo(
    () => (
      <Box>
        <OwnerLabel
          className="owner-label-section"
          hasPermission={hasPermission}
          isCompactView={false}
          maxVisibleOwners={4}
          owners={displayOwners}
          placement="vertical"
          showLabel={false}
        />
      </Box>
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

  const canShowEditButton = showEditButton && hasPermission && !isLoading;

  if (!displayOwners.length) {
    return (
      <Box
        data-testid="owners-section"
        sx={{
          borderBottom: `0.6px solid ${theme.palette.allShades.gray[200]}`,
          paddingBottom: '16px',
        }}>
        <Box
          sx={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            marginBottom: '12px',
            paddingLeft: '14px',
            paddingRight: '14px',
          }}>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: '13px',
              color: (theme) => theme.palette.allShades.gray[900],
            }}>
            {t('label.owner-plural')}
          </Typography>
          {canShowEditButton && (
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
        </Box>
        <Box
          sx={{
            paddingLeft: '14px',
            paddingRight: '14px',
          }}>
          {emptyContent}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      data-testid="owners-section"
      sx={{
        borderBottom: `0.6px solid ${theme.palette.allShades.gray[200]}`,
        paddingBottom: '16px',
      }}>
      <Box
        sx={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          marginBottom: '12px',
          paddingLeft: '14px',
          paddingRight: '14px',
        }}>
        <Typography
          sx={{
            fontWeight: 600,
            fontSize: '13px',
            color: (theme) => theme.palette.allShades.gray[900],
          }}>
          {t('label.owner-plural')}
        </Typography>
        {canShowEditButton && (
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
      </Box>
      <Box
        sx={{
          paddingLeft: '14px',
          paddingRight: '14px',
        }}>
        {ownersContent}
      </Box>
    </Box>
  );
};

export default OwnersSection;

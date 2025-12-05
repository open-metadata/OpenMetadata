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
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { TAG_START_WITH } from '../../../constants/Tag.constants';
import { Tag } from '../../../generated/entity/classification/tag';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { useEditableSection } from '../../../hooks/useEditableSection';
import { updateEntityField } from '../../../utils/EntityUpdateUtils';
import TagsV1 from '../../Tag/TagsV1/TagsV1.component';
import { EditIconButton } from '../IconButtons/EditIconButton';
import TierCard from '../TierCard/TierCard';
import { TierSectionProps } from './TierSection.interface';
import './TierSection.less';

const TierSection: React.FC<TierSectionProps> = ({
  tier,
  tags = [],
  showEditButton = true,
  hasPermission = false,
  entityId,
  entityType,
  onTierUpdate,
}) => {
  const { t } = useTranslation();

  const {
    isEditing,
    isLoading,
    popoverOpen,
    displayData: displayTier,
    setDisplayData: setDisplayTier,
    setIsLoading,
    setPopoverOpen,
    startEditing,
    completeEditing,
    cancelEditing,
  } = useEditableSection<TagLabel | undefined>(tier);

  const handleEditClick = () => {
    startEditing();
  };

  const handleSaveWithTier = useCallback(
    async (selectedTier?: Tag) => {
      setIsLoading(true);

      const updatedTags = tags.filter((tag) => !tag.tagFQN.startsWith('Tier.'));

      if (selectedTier) {
        updatedTags.push({
          tagFQN: selectedTier.fullyQualifiedName ?? '',
          name: selectedTier.name,
          description: selectedTier.description,
          source: TagSource.Classification,
          labelType: 'Manual',
          state: 'Confirmed',
        } as TagLabel);
      }

      const result = await updateEntityField({
        entityId,
        entityType,
        fieldName: 'tags',
        currentValue: tags,
        newValue: updatedTags,
        entityLabel: t('label.tier'),
        onSuccess: (updatedTagsList) => {
          const newTier = updatedTagsList.find((tag) =>
            tag.tagFQN.startsWith('Tier.')
          );
          setDisplayTier(newTier);

          onTierUpdate?.(newTier);
          completeEditing();
        },
        t,
      });

      if (result.success && result.data === tags) {
        const newTier = result.data.find((tag) =>
          tag.tagFQN.startsWith('Tier.')
        );
        setDisplayTier(newTier);
        onTierUpdate?.(newTier);
        completeEditing();
      } else if (!result.success) {
        setIsLoading(false);
      }
    },
    [
      entityId,
      entityType,
      tags,
      onTierUpdate,
      t,
      setDisplayTier,
      setIsLoading,
      completeEditing,
    ]
  );

  const handleCancel = () => {
    setPopoverOpen(false);
  };

  const handleTierSelection = async (selectedTier?: Tag) => {
    await handleSaveWithTier(selectedTier);
  };

  const loadingState = useMemo(
    () => (
      <div className="tier-loading-container">
        <div className="tier-loading-spinner">
          <div className="loading-spinner" />
        </div>
      </div>
    ),
    []
  );

  const editingState = useMemo(
    () => (
      <TierCard
        currentTier={displayTier?.tagFQN}
        footerActionButtonsClassName="tier-card-footer-action-buttons"
        popoverProps={{ open: popoverOpen }}
        tierCardClassName="tier-card-popover"
        updateTier={handleTierSelection}
        onClose={() => {
          handleCancel();
          cancelEditing();
        }}>
        <div className="tier-selector-display">
          {displayTier && (
            <div className="d-flex flex-col gap-2">
              <TagsV1
                hideIcon
                startWith={TAG_START_WITH.SOURCE_ICON}
                tag={displayTier}
                tagProps={{
                  'data-testid': 'Tier',
                }}
              />
            </div>
          )}
        </div>
      </TierCard>
    ),
    [displayTier, popoverOpen, handleTierSelection, handleCancel]
  );

  const tierDisplay = useMemo(
    () => (
      <div className="tier-display">
        {displayTier ? (
          <div className="d-flex flex-col gap-2">
            <TagsV1
              hideIcon
              startWith={TAG_START_WITH.SOURCE_ICON}
              tag={displayTier}
              tagProps={{
                'data-testid': 'Tier',
              }}
            />
          </div>
        ) : (
          <span className="no-data-placeholder">
            {t('label.no-entity-assigned', {
              entity: t('label.tier'),
            })}
          </span>
        )}
      </div>
    ),
    [displayTier, t]
  );

  const tierContent = useMemo(() => {
    if (isLoading) {
      return loadingState;
    }
    if (isEditing) {
      return editingState;
    }

    return tierDisplay;
  }, [isLoading, isEditing, loadingState, editingState, tierDisplay]);

  const canShowEditButton = showEditButton && hasPermission && !isLoading;

  return (
    <div className="tier-section">
      <div className="tier-header">
        <Typography.Text className="tier-title">
          {t('label.tier')}
        </Typography.Text>
        {canShowEditButton && (
          <EditIconButton
            newLook
            data-testid="edit-icon-tier"
            disabled={false}
            icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
            size="small"
            title={t('label.edit-entity', {
              entity: t('label.tier'),
            })}
            onClick={handleEditClick}
          />
        )}
      </div>
      <div className="tier-content">{tierContent}</div>
    </div>
  );
};

export default TierSection;

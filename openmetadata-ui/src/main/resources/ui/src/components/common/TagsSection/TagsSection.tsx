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
import { ReactComponent as ClassificationIcon } from '../../../assets/svg/classification.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { TagLabel } from '../../../generated/type/tagLabel';
import { useEditableSection } from '../../../hooks/useEditableSection';
import { updateEntityField } from '../../../utils/EntityUpdateUtils';
import { EditIconButton } from '../IconButtons/EditIconButton';
import Loader from '../Loader/Loader';
import { TagSelectableList } from '../TagSelectableList/TagSelectableList.component';
import './TagsSection.less';

interface TagsSectionProps {
  tags?: TagLabel[];
  showEditButton?: boolean;
  maxVisibleTags?: number;
  hasPermission?: boolean;
  entityId?: string;
  entityType?: EntityType;
  onTagsUpdate?: (updatedTags: TagLabel[]) => void;
}

const TagsSectionV1: React.FC<TagsSectionProps> = ({
  tags = [],
  showEditButton = true,
  maxVisibleTags = 3,
  hasPermission = false,
  entityId,
  entityType,
  onTagsUpdate,
}) => {
  const { t } = useTranslation();
  const [showAllTags, setShowAllTags] = useState(false);
  const [editingTags, setEditingTags] = useState<TagLabel[]>([]);

  const {
    isEditing,
    isLoading,
    popoverOpen,
    displayData: displayTags,
    setDisplayData: setDisplayTags,
    setIsLoading,
    setPopoverOpen,
    startEditing,
    completeEditing,
  } = useEditableSection<TagLabel[]>(tags);

  const getTagFqn = (tag: TagLabel) =>
    (tag.tagFQN || tag.name || tag.displayName || '').toString();

  const nonTierTags: TagLabel[] = (displayTags || []).filter(
    (t) => !getTagFqn(t).startsWith('Tier.')
  );
  const tierTags: TagLabel[] = (displayTags || []).filter((t) =>
    getTagFqn(t).startsWith('Tier.')
  );

  const getTagDisplayName = (tag: TagLabel) => {
    return tag.displayName || tag.name || tag.tagFQN || t('label.unknown');
  };

  const handleEditClick = () => {
    setEditingTags(nonTierTags);
    startEditing();
  };

  const handleSaveWithTags = useCallback(
    async (tagsToSave: TagLabel[]) => {
      setIsLoading(true);

      const updatedTags: TagLabel[] = [...tierTags, ...tagsToSave];

      const result = await updateEntityField({
        entityId,
        entityType,
        fieldName: 'tags',
        currentValue: displayTags,
        newValue: updatedTags,
        entityLabel: t('label.tag-plural'),
        onSuccess: (tags) => {
          setDisplayTags(tags);
          if (onTagsUpdate) {
            onTagsUpdate(tags);
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
      displayTags,
      tierTags,
      onTagsUpdate,
      t,
      setDisplayTags,
      setIsLoading,
      completeEditing,
    ]
  );

  const handleTagSelection = async (selectedTags: TagLabel[]) => {
    setEditingTags(selectedTags);
    await handleSaveWithTags(selectedTags);
  };

  const handlePopoverOpenChange = (open: boolean) => {
    setPopoverOpen(open);
    if (!open) {
      setEditingTags(nonTierTags);
    }
  };

  const loadingState = useMemo(() => <Loader size="small" />, []);

  const editingState = useMemo(
    () => (
      <TagSelectableList
        hasPermission={hasPermission}
        popoverProps={{
          placement: 'bottomLeft',
          open: popoverOpen,
          onOpenChange: handlePopoverOpenChange,
          overlayClassName: 'tag-select-popover',
        }}
        selectedTags={editingTags}
        onCancel={() => {
          setPopoverOpen(false);
        }}
        onUpdate={handleTagSelection}>
        <div className="d-none tag-selector-display">
          {editingTags.length > 0 && (
            <div className="selected-tags-list">
              {editingTags.map((tag) => (
                <div className="selected-tag-chip" key={tag.tagFQN}>
                  <ClassificationIcon className="tag-icon" />
                  <span className="tag-name">{getTagDisplayName(tag)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </TagSelectableList>
    ),
    [
      hasPermission,
      popoverOpen,
      handlePopoverOpenChange,
      editingTags,
      handleTagSelection,
    ]
  );

  const emptyContent = useMemo(() => {
    if (isLoading) {
      return loadingState;
    }
    if (isEditing) {
      return editingState;
    }

    return (
      <span className="no-data-placeholder">{t('label.no-data-found')}</span>
    );
  }, [isLoading, isEditing, loadingState, editingState, t]);

  const tagsDisplay = useMemo(
    () => (
      <div className="tags-display">
        <div className="tags-list">
          {(showAllTags
            ? nonTierTags
            : nonTierTags.slice(0, maxVisibleTags)
          ).map((tag, index) => (
            <div className="tag-item" key={index}>
              <ClassificationIcon className="tag-icon" />
              <span className="tag-name">{getTagDisplayName(tag)}</span>
            </div>
          ))}
          {nonTierTags.length > maxVisibleTags && (
            <button
              className="show-more-tags-button"
              type="button"
              onClick={() => setShowAllTags(!showAllTags)}>
              {showAllTags
                ? t('label.less')
                : `+${nonTierTags.length - maxVisibleTags} ${t(
                    'label.more-lowercase'
                  )}`}
            </button>
          )}
        </div>
      </div>
    ),
    [showAllTags, nonTierTags, maxVisibleTags, t]
  );

  const tagsContent = useMemo(() => {
    if (isLoading) {
      return loadingState;
    }
    if (isEditing) {
      return editingState;
    }

    return tagsDisplay;
  }, [isLoading, isEditing, loadingState, editingState, tagsDisplay]);

  if (!nonTierTags.length) {
    return (
      <div className="tags-section">
        <div className="tags-header">
          <Typography.Text className="tags-title">
            {t('label.tag-plural')}
          </Typography.Text>
          {showEditButton && hasPermission && !isEditing && !isLoading && (
            <EditIconButton
              newLook
              data-testid="edit-icon-tags"
              disabled={false}
              icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
              size="small"
              title={t('label.edit-entity', {
                entity: t('label.tag-plural'),
              })}
              onClick={handleEditClick}
            />
          )}
        </div>
        <div className="tags-content">{emptyContent}</div>
      </div>
    );
  }

  return (
    <div className="tags-section">
      <div className="tags-header">
        <Typography.Text className="tags-title">
          {t('label.tag-plural')}
        </Typography.Text>
        {showEditButton && hasPermission && !isEditing && !isLoading && (
          <EditIconButton
            newLook
            data-testid="edit-icon-tags"
            disabled={false}
            icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
            size="small"
            title={t('label.edit-entity', {
              entity: t('label.tag-plural'),
            })}
            onClick={handleEditClick}
          />
        )}
      </div>
      <div className="tags-content">{tagsContent}</div>
    </div>
  );
};

export default TagsSectionV1;

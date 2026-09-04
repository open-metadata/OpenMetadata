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
import { Button } from '@openmetadata/ui-core-components';
import { Typography } from 'antd';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { useEditableSection } from '../../../hooks/useEditableSection';
import { updateEntityField } from '../../../utils/EntityUpdateUtils';
import { getTagName, getTagRedirectLink } from '../../../utils/TagsPureUtils';
import ClassificationTag from '../atoms/Tag/ClassificationTag';
import { EditIconButton } from '../IconButtons/EditIconButton';
import Loader from '../Loader/Loader';
import { TagSelectableList } from '../TagSelectableList/TagSelectableList.component';
import { TagsSectionProps } from './TagsSection.interface';
import './TagsSection.less';

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
    cancelEditing,
  } = useEditableSection<TagLabel[]>(tags);

  const getTagFqn = (tag: TagLabel) =>
    (tag.tagFQN || tag.name || tag.displayName || '').toString();

  const nonTierTags: TagLabel[] = (displayTags || []).filter(
    (t) => !getTagFqn(t).startsWith('Tier.') && t.source !== TagSource.Glossary
  );
  const tierTags: TagLabel[] = (displayTags || []).filter((t) =>
    getTagFqn(t).startsWith('Tier.')
  );

  const handleEditClick = () => {
    setEditingTags(nonTierTags);
    startEditing();
  };

  const handleSaveWithTags = useCallback(
    async (tagsToSave: TagLabel[]) => {
      setIsLoading(true);

      const glossaryTags = displayTags.filter(
        (tag) => tag.source === TagSource.Glossary
      );
      const updatedTags: TagLabel[] = [
        ...tierTags,
        ...glossaryTags,
        ...tagsToSave,
      ];

      // When onTagsUpdate is provided, use it directly as the update mechanism
      // This avoids updateEntityField's fallback behavior for non-standard entity types
      if (onTagsUpdate) {
        try {
          const resultTags = await onTagsUpdate(updatedTags);
          if (resultTags) {
            setDisplayTags(resultTags);
          }
          completeEditing();
        } catch {
          // Revert editing state so the UI doesn't show the failed selection
          setEditingTags(nonTierTags);
          cancelEditing();
          setIsLoading(false);
        }

        return;
      }

      const result = await updateEntityField({
        entityId,
        entityType,
        fieldName: 'tags',
        currentValue: displayTags,
        newValue: updatedTags,
        entityLabel: t('label.tag-plural'),
        onSuccess: (tags) => {
          setDisplayTags(tags);
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
          // The anchor is the full-width `.tag-selector-display` div below, not the pencil, so a
          // centered placement ('top' → align points bc/tc) pushes the popover to the middle of a
          // wide container. `bottomLeft` pins it to the anchor's left edge, matching how
          // GlossaryTermsSection anchors its own popover.
          placement: 'bottomLeft',
          open: popoverOpen,
          onOpenChange: handlePopoverOpenChange,
          overlayClassName: 'tag-select-popover',
        }}
        selectedTags={editingTags}
        onCancel={() => {
          setPopoverOpen(false);
          cancelEditing();
        }}
        onUpdate={handleTagSelection}>
        <div className="d-none tag-selector-display">
          {editingTags.length > 0 ? (
            <div className="tw:flex tw:flex-wrap tw:gap-1">
              {editingTags.map((tag) => (
                <ClassificationTag
                  color={tag.style?.color}
                  data-testid={`tag-${tag.tagFQN}`}
                  href={getTagRedirectLink(tag)}
                  icon={tag.style?.iconURL}
                  key={tag.tagFQN}
                  label={getTagName(tag)}
                  maxWidth={200}
                  size="sm"
                  tooltip={getTagName(tag)}
                />
              ))}
            </div>
          ) : (
            <span className="no-data-placeholder">
              {t('label.no-entity-assigned', {
                entity: t('label.tag-plural'),
              })}
            </span>
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
      <span className="no-data-placeholder">
        {t('label.no-entity-assigned', {
          entity: t('label.tag-plural'),
        })}
      </span>
    );
  }, [isLoading, isEditing, loadingState, editingState, t]);

  const tagsDisplay = useMemo(
    () => (
      <div className="tags-display" data-testid="tags-section-container">
        <div className="tw:flex tw:flex-wrap tw:gap-1">
          {(showAllTags
            ? nonTierTags
            : nonTierTags.slice(0, maxVisibleTags)
          ).map((tag) => (
            <ClassificationTag
              color={tag.style?.color}
              data-testid={`tag-${tag.tagFQN}`}
              href={getTagRedirectLink(tag)}
              icon={tag.style?.iconURL}
              key={tag.tagFQN}
              label={getTagName(tag)}
              maxWidth={200}
              size="sm"
              tooltip={getTagName(tag)}
            />
          ))}
          {nonTierTags.length > maxVisibleTags && (
            <Button
              color="link-color"
              size="xs"
              type="button"
              onClick={() => setShowAllTags(!showAllTags)}>
              {showAllTags
                ? t('label.less')
                : `+${nonTierTags.length - maxVisibleTags} ${t(
                    'label.more-lowercase'
                  )}`}
            </Button>
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

  const canShowEditButton = showEditButton && hasPermission && !isLoading;

  if (!nonTierTags.length) {
    return (
      <div className="tags-section">
        <div className="tags-header">
          <Typography.Text className="tags-title">
            {t('label.tag-plural')}
          </Typography.Text>
          {canShowEditButton && (
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
        {canShowEditButton && (
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

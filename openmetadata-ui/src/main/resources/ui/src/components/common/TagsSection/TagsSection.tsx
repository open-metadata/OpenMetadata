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
import {
  Button,
  ClassificationTag,
  Typography,
} from '@openmetadata/ui-core-components';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { useEditableSection } from '../../../hooks/useEditableSection';
import { updateEntityField } from '../../../utils/EntityUpdateUtils';
import { getTagName, getTagRedirectLink } from '../../../utils/TagsPureUtils';
import ClassificationTagPicker from '../ClassificationTagPicker/ClassificationTagPicker';
import { EditIconButton } from '../IconButtons/EditIconButton';
import Loader from '../Loader/Loader';
import { TagsSectionProps } from './TagsSection.interface';
import './TagsSection.less';

const getTagFqn = (tag: TagLabel) =>
  (tag.tagFQN || tag.name || tag.displayName || '').toString();

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

  const {
    isEditing,
    isLoading,
    displayData: displayTags,
    setDisplayData: setDisplayTags,
    setIsLoading,
    startEditing,
    completeEditing,
    cancelEditing,
  } = useEditableSection<TagLabel[]>(tags);

  const { nonTierTags, tierTags } = useMemo(
    () => ({
      nonTierTags: (displayTags || []).filter(
        (tag) =>
          !getTagFqn(tag).startsWith('Tier.') &&
          tag.source !== TagSource.Glossary
      ),
      tierTags: (displayTags || []).filter((tag) =>
        getTagFqn(tag).startsWith('Tier.')
      ),
    }),
    [displayTags]
  );

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
      cancelEditing,
    ]
  );

  const editButton = useMemo(
    () =>
      showEditButton && hasPermission && !isLoading ? (
        <ClassificationTagPicker
          commitMode="staged"
          data-testid="classification-tag-picker"
          isOpen={isEditing}
          renderTrigger={({ toggle }) => (
            <EditIconButton
              newLook
              data-testid="edit-icon-tags"
              disabled={false}
              icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
              size="small"
              title={t('label.edit-entity', {
                entity: t('label.tag-plural'),
              })}
              onClick={toggle}
            />
          )}
          value={nonTierTags}
          onChange={handleSaveWithTags}
          onOpenChange={(open) => (open ? startEditing() : cancelEditing())}
        />
      ) : null,
    [
      showEditButton,
      hasPermission,
      isLoading,
      isEditing,
      nonTierTags,
      handleSaveWithTags,
      startEditing,
      cancelEditing,
      t,
    ]
  );

  const tagsContent = useMemo(() => {
    if (isLoading) {
      return <Loader size="small" />;
    }

    if (!nonTierTags.length) {
      return (
        <span className="no-data-placeholder">
          {t('label.no-entity-assigned', {
            entity: t('label.tag-plural'),
          })}
        </span>
      );
    }

    return (
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
    );
  }, [isLoading, nonTierTags, showAllTags, maxVisibleTags, t]);

  return (
    <div className="tags-section">
      <div className="tags-header">
        <Typography className="tags-title">{t('label.tag-plural')}</Typography>
        {editButton}
      </div>
      <div className="tags-content">{tagsContent}</div>
    </div>
  );
};

export default TagsSectionV1;

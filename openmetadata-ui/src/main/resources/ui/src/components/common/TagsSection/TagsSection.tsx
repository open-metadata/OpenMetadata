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
import { ReactComponent as ClassificationIcon } from '../../../assets/svg/classification.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { useEditableSection } from '../../../hooks/useEditableSection';
import { updateEntityField } from '../../../utils/EntityUpdateUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { EditIconButton } from '../IconButtons/EditIconButton';
import Loader from '../Loader/Loader';
import { TagSelectableList } from '../TagSelectableList/TagSelectableList.component';
import { TagsSectionProps } from './TagsSection.interface';

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
  const theme = useTheme();
  const [showAllTags, setShowAllTags] = useState(false);
  const [editingTags, setEditingTags] = useState<TagLabel[]>([]);

  const {
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
    setPopoverOpen(true);
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

      const result = await updateEntityField({
        entityId,
        entityType,
        fieldName: 'tags',
        currentValue: displayTags,
        newValue: updatedTags,
        entityLabel: t('label.tag-plural'),
        onSuccess: (tags) => {
          setDisplayTags(tags);
          onTagsUpdate?.(tags);
          completeEditing();
        },
        t,
      });

      if (result.success && result.data === displayTags) {
        completeEditing();
      } else if (!result.success) {
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
      cancelEditing();
    }
  };

  const handleCancel = () => {
    setEditingTags(nonTierTags);
    cancelEditing();
  };

  const loadingState = useMemo(() => <Loader size="small" />, []);

  const editButton = useMemo(
    () => (
      <TagSelectableList
        hasPermission={hasPermission}
        popoverProps={{
          placement: 'topRight',
          open: popoverOpen,
          onOpenChange: handlePopoverOpenChange,
          overlayClassName: 'tag-select-popover',
        }}
        selectedTags={editingTags}
        onCancel={handleCancel}
        onUpdate={handleTagSelection}>
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
      </TagSelectableList>
    ),
    [
      hasPermission,
      popoverOpen,
      handlePopoverOpenChange,
      editingTags,
      handleCancel,
      handleTagSelection,
      handleEditClick,
      t,
    ]
  );

  const emptyContent = useMemo(() => {
    if (isLoading) {
      return loadingState;
    }

    return (
      <Box
        component="span"
        sx={{
          color: theme.palette.allShades.gray[500],
          fontSize: '12px',
        }}>
        {t('label.no-entity-assigned', {
          entity: t('label.tag-plural'),
        })}
      </Box>
    );
  }, [isLoading, loadingState, t, theme]);

  const tagsDisplay = useMemo(
    () => (
      <Box>
        <Box display="flex" flexDirection="row" flexWrap="wrap" gap="8px">
          {(showAllTags
            ? nonTierTags
            : nonTierTags.slice(0, maxVisibleTags)
          ).map((tag) => (
            <Box
              alignItems="center"
              borderRadius="8px"
              data-testid={`tag-${tag.tagFQN}`}
              display="flex"
              gap="5px"
              height="26px"
              key={tag.tagFQN}
              sx={{
                backgroundColor: theme.palette.allShades.blueGray[75],
                padding: '5px 6px',
                border: `1px solid ${theme.palette.allShades.blueGray[150]}`,
                minWidth: 0,
                '& .tag-icon': {
                  height: '12px',
                  width: '12px',
                  flexShrink: 0,
                },
              }}>
              <ClassificationIcon className="tag-icon" />
              <Box
                component="span"
                sx={{
                  fontSize: '12px',
                  fontWeight: 400,
                  color: theme.palette.allShades.gray[800],
                  textOverflow: 'ellipsis',
                }}>
                {getEntityName(tag)}
              </Box>
            </Box>
          ))}
          {nonTierTags.length > maxVisibleTags && (
            <Box
              alignItems="center"
              component="button"
              display="flex"
              height="auto"
              justifyContent="flex-start"
              padding={0}
              sx={{
                backgroundColor: 'transparent',
                border: 'none',
                color: theme.palette.primary.main,
                fontSize: '12px',
                fontWeight: 400,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  textDecoration: 'underline',
                },
                '&:focus': {
                  outline: 'none',
                },
              }}
              type="button"
              width="100%"
              onClick={() => setShowAllTags(!showAllTags)}>
              {showAllTags
                ? t('label.less')
                : `+${nonTierTags.length - maxVisibleTags} ${t(
                    'label.more-lowercase'
                  )}`}
            </Box>
          )}
        </Box>
      </Box>
    ),
    [showAllTags, nonTierTags, maxVisibleTags, t, theme]
  );

  const tagsContent = useMemo(() => {
    if (isLoading) {
      return loadingState;
    }

    return tagsDisplay;
  }, [isLoading, loadingState, tagsDisplay]);

  const canShowEditButton = showEditButton && hasPermission && !isLoading;

  if (!nonTierTags.length) {
    return (
      <Box
        data-testid="tags-section"
        sx={{
          borderBottom: `0.6px solid ${theme.palette.allShades.gray[200]}`,
          paddingBottom: '16px',
        }}>
        <Box
          alignItems="center"
          display="flex"
          gap="8px"
          marginBottom="12px"
          paddingX="14px">
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: '13px',
              color: theme.palette.allShades.gray[900],
            }}>
            {t('label.tag-plural')}
          </Typography>
          {canShowEditButton && editButton}
        </Box>
        <Box paddingX="14px">{emptyContent}</Box>
      </Box>
    );
  }

  return (
    <Box
      data-testid="tags-section"
      sx={{
        borderBottom: `0.6px solid ${theme.palette.allShades.gray[200]}`,
        paddingBottom: '16px',
      }}>
      <Box
        alignItems="center"
        display="flex"
        gap="8px"
        marginBottom="12px"
        paddingX="14px">
        <Typography
          sx={{
            fontWeight: 600,
            fontSize: '13px',
            color: theme.palette.allShades.gray[900],
          }}>
          {t('label.tag-plural')}
        </Typography>
        {canShowEditButton && editButton}
      </Box>
      <Box paddingX="14px">{tagsContent}</Box>
    </Box>
  );
};

export default TagsSectionV1;

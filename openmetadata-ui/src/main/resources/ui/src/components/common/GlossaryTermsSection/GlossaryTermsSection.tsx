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
import { ReactComponent as GlossaryIcon } from '../../../assets/svg/glossary.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { useEditableSection } from '../../../hooks/useEditableSection';
import { updateEntityField } from '../../../utils/EntityUpdateUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { GlossaryTermSelectableList } from '../GlossaryTermSelectableList/GlossaryTermSelectableList.component';
import { EditIconButton } from '../IconButtons/EditIconButton';
import Loader from '../Loader/Loader';
import { GlossaryTermsSectionProps } from './GlossaryTermsSection.interface';

const GlossaryTermsSection: React.FC<GlossaryTermsSectionProps> = ({
  tags = [],
  showEditButton = true,
  hasPermission = false,
  entityId,
  entityType,
  onGlossaryTermsUpdate,
  maxVisibleGlossaryTerms = 3,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [editingGlossaryTerms, setEditingGlossaryTerms] = useState<TagLabel[]>(
    []
  );
  const [showAllTerms, setShowAllTerms] = useState(false);

  const {
    isLoading,
    popoverOpen,
    displayData: displayTags,
    setDisplayData: setDisplayTags,
    setIsLoading,
    setPopoverOpen,
    startEditing,
    cancelEditing,
    completeEditing,
  } = useEditableSection<TagLabel[]>(tags);

  const glossaryTerms = displayTags.filter(
    (tag) => tag.source === TagSource.Glossary
  );

  const handleEditClick = () => {
    setEditingGlossaryTerms(glossaryTerms);
    startEditing();
    setPopoverOpen(true);
  };

  const handleGlossaryTermSelection = useCallback(
    async (selectedTerms: TagLabel[]) => {
      try {
        if (!entityId || !entityType) {
          return;
        }
        // Update the local state for the selectable list with the new selection
        setEditingGlossaryTerms(selectedTerms);

        setIsLoading(true);

        const nonGlossaryTags = displayTags.filter(
          (tag) => tag.source !== TagSource.Glossary
        );
        const updatedTags = [...nonGlossaryTags, ...selectedTerms];

        const result = await updateEntityField({
          entityId,
          entityType: entityType as EntityType,
          fieldName: 'tags',
          currentValue: displayTags,
          newValue: updatedTags,
          entityLabel: t('label.glossary-term-plural'),
          onSuccess: (newTags: TagLabel[]) => {
            setDisplayTags(newTags);
            onGlossaryTermsUpdate?.(newTags);
            completeEditing();
          },
          t,
        });

        if (result.success && result.data === displayTags) {
          completeEditing();
        } else if (!result.success) {
          setIsLoading(false);
        }
      } catch (error) {
        setIsLoading(false);
      }
    },
    [
      entityId,
      entityType,
      displayTags,
      onGlossaryTermsUpdate,
      t,
      setIsLoading,
      setDisplayTags,
      completeEditing,
    ]
  );

  const handlePopoverOpenChange = (open: boolean) => {
    setPopoverOpen(open);
    if (!open) {
      setEditingGlossaryTerms(glossaryTerms);
      cancelEditing();
    }
  };

  const handleCancel = () => {
    setEditingGlossaryTerms(glossaryTerms);
    cancelEditing();
  };

  const loadingState = useMemo(() => <Loader size="small" />, []);

  const editButton = useMemo(
    () => (
      <GlossaryTermSelectableList
        popoverProps={{
          placement: 'topRight',
          open: popoverOpen,
          onOpenChange: handlePopoverOpenChange,
          overlayClassName: 'glossary-term-select-popover',
        }}
        selectedTerms={editingGlossaryTerms}
        onCancel={handleCancel}
        onUpdate={handleGlossaryTermSelection}>
        <EditIconButton
          newLook
          data-testid="edit-glossary-terms"
          disabled={false}
          icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
          size="small"
          title={t('label.edit-entity', {
            entity: t('label.glossary-term-plural'),
          })}
          onClick={handleEditClick}
        />
      </GlossaryTermSelectableList>
    ),
    [
      popoverOpen,
      handlePopoverOpenChange,
      editingGlossaryTerms,
      handleCancel,
      handleGlossaryTermSelection,
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
          entity: t('label.glossary-term-plural'),
        })}
      </Box>
    );
  }, [isLoading, loadingState, t, theme]);

  const glossaryTermsDisplay = useMemo(
    () => (
      <Box>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
          }}>
          {(showAllTerms
            ? glossaryTerms
            : glossaryTerms.slice(0, maxVisibleGlossaryTerms)
          ).map((glossaryTerm, index) => (
            <Box
              data-testid={`tag-${
                glossaryTerm.tagFQN ||
                glossaryTerm.name ||
                glossaryTerm.displayName ||
                index
              }`}
              key={glossaryTerm.tagFQN}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 6px',
                height: '26px',
                borderRadius: '8px',
                minWidth: 0,
                backgroundColor: theme.palette.allShades.blueGray[75],
                border: `1px solid ${theme.palette.allShades.blueGray[150]}`,
                '& .glossary-term-icon': {
                  width: '12px',
                  height: '12px',
                  color: theme.palette.allShades.gray[800],
                  flexShrink: 0,
                },
              }}>
              <GlossaryIcon className="glossary-term-icon" />
              <Box
                component="span"
                sx={{
                  color: theme.palette.allShades.gray[800],
                  fontSize: '12px',
                  fontWeight: 400,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                {getEntityName(glossaryTerm)}
              </Box>
            </Box>
          ))}
          {glossaryTerms.length > maxVisibleGlossaryTerms && (
            <Box
              component="button"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                padding: 0,
                height: 'auto',
                width: '100%',
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
              onClick={() => setShowAllTerms(!showAllTerms)}>
              {showAllTerms
                ? t('label.less')
                : `+${glossaryTerms.length - maxVisibleGlossaryTerms} ${t(
                    'label.more-lowercase'
                  )}`}
            </Box>
          )}
        </Box>
      </Box>
    ),
    [showAllTerms, glossaryTerms, maxVisibleGlossaryTerms, t]
  );

  const glossaryTermsContent = useMemo(() => {
    if (isLoading) {
      return loadingState;
    }

    return glossaryTermsDisplay;
  }, [isLoading, loadingState, glossaryTermsDisplay]);

  const canShowEditButton = showEditButton && hasPermission && !isLoading;

  if (!glossaryTerms?.length) {
    return (
      <Box
        data-testid="glossary-terms-section"
        sx={{
          borderBottom: `0.6px solid ${theme.palette.allShades.gray[200]}`,
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
              color: theme.palette.allShades.gray[900],
              fontSize: '13px',
            }}>
            {t('label.glossary-term-plural')}
          </Typography>
          {canShowEditButton && editButton}
        </Box>
        <Box
          data-testid="glossary-container"
          sx={{
            paddingLeft: '14px',
            paddingRight: '14px',
            paddingBottom: '16px',
          }}>
          {emptyContent}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      data-testid="glossary-terms-section"
      sx={{
        borderBottom: `0.6px solid ${theme.palette.allShades.gray[200]}`,
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
            color: theme.palette.allShades.gray[900],
            fontSize: '13px',
          }}>
          {t('label.glossary-term-plural')}
        </Typography>
        {canShowEditButton && editButton}
      </Box>
      <Box
        data-testid="glossary-container"
        sx={{
          paddingLeft: '14px',
          paddingRight: '14px',
          paddingBottom: '16px',
        }}>
        {glossaryTermsContent}
      </Box>
    </Box>
  );
};

export default GlossaryTermsSection;

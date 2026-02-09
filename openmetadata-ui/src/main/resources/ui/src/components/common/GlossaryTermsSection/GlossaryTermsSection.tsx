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
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as GlossaryIcon } from '../../../assets/svg/glossary.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { useEditableSection } from '../../../hooks/useEditableSection';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { updateEntityField } from '../../../utils/EntityUpdateUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { GlossaryTermSelectableList } from '../GlossaryTermSelectableList/GlossaryTermSelectableList.component';
import { EditIconButton } from '../IconButtons/EditIconButton';
import Loader from '../Loader/Loader';
import { GlossaryTermsSectionProps } from './GlossaryTermsSection.interface';
import './GlossaryTermsSection.less';

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
  const [editingGlossaryTerms, setEditingGlossaryTerms] = useState<TagLabel[]>(
    []
  );
  const [showAllTerms, setShowAllTerms] = useState(false);
  const { entityRules } = useEntityRules(entityType);

  const {
    isEditing,
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

        // When onGlossaryTermsUpdate is provided, use it directly as the update mechanism
        // This avoids updateEntityField's fallback behavior for non-standard entity types
        if (onGlossaryTermsUpdate) {
          try {
            const resultTags = await onGlossaryTermsUpdate(updatedTags);
            if (resultTags) {
              setDisplayTags(resultTags);
            }
            completeEditing();
          } catch {
            // Revert editing state so the UI doesn't show the failed selection
            setEditingGlossaryTerms(glossaryTerms);
            cancelEditing();
            setIsLoading(false);
          }

          return;
        }

        const result = await updateEntityField({
          entityId,
          entityType: entityType,
          fieldName: 'tags',
          currentValue: displayTags,
          newValue: updatedTags,
          entityLabel: t('label.glossary-term-plural'),
          onSuccess: (newTags: TagLabel[]) => {
            setDisplayTags(newTags);
          },
          t,
        });

        if (result.success) {
          completeEditing();
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
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
    }
  };

  const handleCancel = () => {
    setEditingGlossaryTerms(glossaryTerms);
    cancelEditing();
  };

  const loadingState = useMemo(() => <Loader size="small" />, []);

  const editingState = useMemo(
    () => (
      <GlossaryTermSelectableList
        multiSelect={entityRules.canAddMultipleGlossaryTerm}
        popoverProps={{
          placement: 'bottomLeft',
          open: popoverOpen,
          onOpenChange: handlePopoverOpenChange,
          overlayClassName: 'glossary-term-select-popover',
        }}
        selectedTerms={editingGlossaryTerms}
        onCancel={handleCancel}
        onUpdate={handleGlossaryTermSelection}>
        <div className="d-none glossary-term-selector-display">
          {editingGlossaryTerms.length > 0 ? (
            <div className="selected-glossary-terms-list">
              {editingGlossaryTerms.map((term) => (
                <div className="selected-glossary-term-chip" key={term.tagFQN}>
                  <GlossaryIcon className="glossary-term-icon" />
                  <span className="glossary-term-name">
                    {getEntityName(term)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <span className="no-data-placeholder">
              {t('label.no-entity-assigned', {
                entity: t('label.glossary-term-plural'),
              })}
            </span>
          )}
        </div>
      </GlossaryTermSelectableList>
    ),
    [
      popoverOpen,
      handlePopoverOpenChange,
      editingGlossaryTerms,
      handleCancel,
      handleGlossaryTermSelection,
      entityRules.canAddMultipleGlossaryTerm,
      t,
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
          entity: t('label.glossary-term-plural'),
        })}
      </span>
    );
  }, [isLoading, isEditing, loadingState, editingState, t]);

  const glossaryTermsDisplay = useMemo(
    () => (
      <div className="glossary-terms-display">
        <div className="glossary-terms-list">
          {(showAllTerms
            ? glossaryTerms
            : glossaryTerms.slice(0, maxVisibleGlossaryTerms)
          ).map((glossaryTerm, index) => (
            <div
              className="glossary-term-item"
              data-testid={`tag-${
                glossaryTerm.tagFQN ||
                glossaryTerm.name ||
                glossaryTerm.displayName ||
                index
              }`}
              key={glossaryTerm.tagFQN}>
              <GlossaryIcon className="glossary-term-icon" />
              <span className="glossary-term-name">
                {getEntityName(glossaryTerm)}
              </span>
            </div>
          ))}
          {glossaryTerms.length > maxVisibleGlossaryTerms && (
            <button
              className="show-more-terms-button"
              type="button"
              onClick={() => setShowAllTerms(!showAllTerms)}>
              {showAllTerms
                ? t('label.less')
                : `+${glossaryTerms.length - maxVisibleGlossaryTerms} ${t(
                    'label.more-lowercase'
                  )}`}
            </button>
          )}
        </div>
      </div>
    ),
    [showAllTerms, glossaryTerms, maxVisibleGlossaryTerms, t]
  );

  const glossaryTermsContent = useMemo(() => {
    if (isLoading) {
      return loadingState;
    }
    if (isEditing) {
      return editingState;
    }

    return glossaryTermsDisplay;
  }, [isLoading, isEditing, loadingState, editingState, glossaryTermsDisplay]);

  const canShowEditButton = showEditButton && hasPermission && !isLoading;

  if (!glossaryTerms?.length) {
    return (
      <div
        className="glossary-terms-section"
        data-testid="KnowledgePanel.GlossaryTerms">
        <div className="glossary-terms-header">
          <Typography.Text className="glossary-terms-title">
            {t('label.glossary-term-plural')}
          </Typography.Text>
          {canShowEditButton && (
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
          )}
        </div>
        <div
          className="glossary-terms-content"
          data-testid="glossary-container">
          {emptyContent}
        </div>
      </div>
    );
  }

  return (
    <div
      className="glossary-terms-section"
      data-testid="KnowledgePanel.GlossaryTerms">
      <div className="glossary-terms-header">
        <Typography.Text className="glossary-terms-title">
          {t('label.glossary-term-plural')}
        </Typography.Text>
        {canShowEditButton && (
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
        )}
      </div>
      <div className="glossary-terms-content" data-testid="glossary-container">
        {glossaryTermsContent}
      </div>
    </div>
  );
};

export default GlossaryTermsSection;

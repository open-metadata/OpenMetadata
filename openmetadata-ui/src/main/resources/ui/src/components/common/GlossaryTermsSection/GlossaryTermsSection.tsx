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
import { GlossaryTag } from '@openmetadata/ui-core-components';
import { Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { useEditableSection } from '../../../hooks/useEditableSection';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { updateEntityField } from '../../../utils/EntityUpdateUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import GlossaryTermPicker from '../GlossaryTermPicker/GlossaryTermPicker';
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
  const [showAllTerms, setShowAllTerms] = useState(false);
  const { entityRules } = useEntityRules(entityType);

  const {
    isEditing,
    isLoading,
    displayData: displayTags,
    setDisplayData: setDisplayTags,
    setIsLoading,
    startEditing,
    cancelEditing,
    completeEditing,
  } = useEditableSection<TagLabel[]>(tags);

  const glossaryTerms = useMemo(
    () => displayTags.filter((tag) => tag.source === TagSource.Glossary),
    [displayTags]
  );

  const handleGlossaryTermSelection = useCallback(
    async (selectedTerms: TagLabel[]) => {
      try {
        if (!entityId || !entityType) {
          return;
        }

        setIsLoading(true);

        const nonGlossaryTags = displayTags.filter(
          (tag) => tag.source !== TagSource.Glossary
        );
        const updatedTags = [...nonGlossaryTags, ...selectedTerms];

        // Provided directly, this skips updateEntityField's fallback for
        // non-standard entity types.
        if (onGlossaryTermsUpdate) {
          try {
            const resultTags = await onGlossaryTermsUpdate(updatedTags);
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
      cancelEditing,
    ]
  );

  const loadingState = useMemo(() => <Loader size="small" />, []);

  // The picker is anchored on the edit icon, so the body always shows the terms.
  const editButton = useMemo(
    () =>
      showEditButton && hasPermission && !isLoading ? (
        <GlossaryTermPicker
          commitMode="staged"
          data-testid="glossary-term-picker"
          isOpen={isEditing}
          multiple={entityRules.canAddMultipleGlossaryTerm}
          renderTrigger={({ toggle }) => (
            <EditIconButton
              newLook
              data-testid="edit-glossary-terms"
              disabled={false}
              icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
              size="small"
              title={t('label.edit-entity', {
                entity: t('label.glossary-term-plural'),
              })}
              onClick={toggle}
            />
          )}
          value={glossaryTerms}
          onChange={handleGlossaryTermSelection}
          onOpenChange={(open) => (open ? startEditing() : cancelEditing())}
        />
      ) : null,
    [
      showEditButton,
      hasPermission,
      isLoading,
      isEditing,
      entityRules.canAddMultipleGlossaryTerm,
      glossaryTerms,
      handleGlossaryTermSelection,
      startEditing,
      cancelEditing,
      t,
    ]
  );

  const glossaryTermsContent = useMemo(() => {
    if (isLoading) {
      return loadingState;
    }

    if (!glossaryTerms.length) {
      return (
        <span className="no-data-placeholder">
          {t('label.no-entity-assigned', {
            entity: t('label.glossary-term-plural'),
          })}
        </span>
      );
    }

    return (
      <div className="glossary-terms-display">
        <div className="glossary-terms-list">
          {(showAllTerms
            ? glossaryTerms
            : glossaryTerms.slice(0, maxVisibleGlossaryTerms)
          ).map((glossaryTerm, index) => (
            <GlossaryTag
              color={glossaryTerm.style?.color}
              data-testid={`tag-${
                glossaryTerm.tagFQN ||
                glossaryTerm.name ||
                glossaryTerm.displayName ||
                index
              }`}
              icon={glossaryTerm.style?.iconURL}
              key={glossaryTerm.tagFQN}
              label={getEntityName(glossaryTerm)}
              tooltip={getEntityName(glossaryTerm)}
            />
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
    );
  }, [
    isLoading,
    loadingState,
    glossaryTerms,
    showAllTerms,
    maxVisibleGlossaryTerms,
    t,
  ]);

  return (
    <div
      className="glossary-terms-section"
      data-testid="KnowledgePanel.GlossaryTerms">
      <div className="glossary-terms-header">
        <Typography.Text className="glossary-terms-title">
          {t('label.glossary-term-plural')}
        </Typography.Text>
        {editButton}
      </div>
      <div className="glossary-terms-content" data-testid="glossary-container">
        {glossaryTermsContent}
      </div>
    </div>
  );
};

export default GlossaryTermsSection;

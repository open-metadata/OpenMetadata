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
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as GlossaryIcon } from '../../../assets/svg/glossary.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { useEditableSection } from '../../../hooks/useEditableSection';
import { getEntityName } from '../../../utils/EntityUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { GlossaryTermSelectableList } from '../GlossaryTermSelectableList/GlossaryTermSelectableList.component';
import { EditIconButton } from '../IconButtons/EditIconButton';
import Loader from '../Loader/Loader';
import './GlossaryTermsSection.less';

interface GlossaryTermsSectionProps {
  tags?: TagLabel[];
  showEditButton?: boolean;
  hasPermission?: boolean;
  entityId?: string;
  onGlossaryTermsUpdate?: (updatedTags: TagLabel[]) => void;
  maxVisibleGlossaryTerms?: number;
}

const GlossaryTermsSectionV1: React.FC<GlossaryTermsSectionProps> = ({
  tags = [],
  showEditButton = true,
  hasPermission = false,
  entityId,
  onGlossaryTermsUpdate,
  maxVisibleGlossaryTerms = 3,
}) => {
  const { t } = useTranslation();
  const [editingGlossaryTerms, setEditingGlossaryTerms] = useState<TagLabel[]>(
    []
  );
  const [showAllTerms, setShowAllTerms] = useState(false);

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

  const handleGlossaryTermSelection = async (selectedTerms: TagLabel[]) => {
    try {
      setIsLoading(true);

      const nonGlossaryTags = displayTags.filter(
        (tag) => tag.source !== TagSource.Glossary
      );
      const updatedTags = [...nonGlossaryTags, ...selectedTerms];

      setDisplayTags(updatedTags);

      if (onGlossaryTermsUpdate) {
        await Promise.resolve(onGlossaryTermsUpdate(updatedTags));
      }

      completeEditing();
    } catch (error) {
      setIsLoading(false);
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: t('label.glossary-term-plural'),
        })
      );
    }
  };

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
          {editingGlossaryTerms.length > 0 && isEditing && (
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
      isEditing,
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

  if (!glossaryTerms?.length) {
    return (
      <div
        className="glossary-terms-section"
        data-testid="KnowledgePanel.GlossaryTerms">
        <div className="glossary-terms-header">
          <Typography.Text className="glossary-terms-title">
            {t('label.glossary-term-plural')}
          </Typography.Text>
          {showEditButton && hasPermission && !isEditing && !isLoading && (
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
        {showEditButton && hasPermission && !isEditing && !isLoading && (
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

export default GlossaryTermsSectionV1;

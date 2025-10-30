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
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit.svg';
import { ReactComponent as GlossaryIcon } from '../../../assets/svg/glossary.svg';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { getEntityName } from '../../../utils/EntityUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { GlossaryTermSelectableListV1 } from '../GlossaryTermSelectableList/GlossaryTermSelectableList.component';
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
  const [isEditing, setIsEditing] = useState(false);
  const [editingGlossaryTerms, setEditingGlossaryTerms] = useState<TagLabel[]>(
    []
  );
  const [displayTags, setDisplayTags] = useState<TagLabel[]>(tags);
  const [isLoading, setIsLoading] = useState(false);
  const [showAllTerms, setShowAllTerms] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  React.useEffect(() => {
    setDisplayTags((prev) => {
      if (JSON.stringify(prev) !== JSON.stringify(tags)) {
        return tags;
      }

      return prev;
    });
  }, [tags]);

  const glossaryTerms = displayTags.filter(
    (tag) => tag.source === TagSource.Glossary
  );

  const handleEditClick = () => {
    setEditingGlossaryTerms(glossaryTerms);
    setIsEditing(true);
    setPopoverOpen(true);
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

      setTimeout(() => {
        setIsEditing(false);
        setIsLoading(false);
        setPopoverOpen(false);
      }, 500);
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
      setIsEditing(false);
      setEditingGlossaryTerms(glossaryTerms);
    }
  };

  const handleCancel = () => {
    setEditingGlossaryTerms(glossaryTerms);
    setIsEditing(false);
  };

  const renderLoadingState = () => (
    <div className="glossary-terms-loading-container">
      <div className="glossary-terms-loading-spinner">
        <div className="loading-spinner" />
      </div>
    </div>
  );

  const renderEditingState = () => (
    <GlossaryTermSelectableListV1
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
    </GlossaryTermSelectableListV1>
  );

  const renderEmptyContent = () => {
    if (isLoading) {
      return renderLoadingState();
    }
    if (isEditing) {
      return renderEditingState();
    }

    return (
      <span className="no-data-placeholder">{t('label.no-data-found')}</span>
    );
  };

  const renderGlossaryTermsDisplay = () => (
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
              (glossaryTerm as any).name ||
              (glossaryTerm as any).displayName ||
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
  );

  const renderGlossaryTermsContent = () => {
    if (isLoading) {
      return renderLoadingState();
    }
    if (isEditing) {
      return renderEditingState();
    }

    return renderGlossaryTermsDisplay();
  };

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
            <button
              className="edit-icon"
              type="button"
              onClick={handleEditClick}>
              <EditIcon />
            </button>
          )}
        </div>
        <div
          className="glossary-terms-content"
          data-testid="glossary-container">
          {renderEmptyContent()}
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
          <button className="edit-icon" type="button" onClick={handleEditClick}>
            <EditIcon />
          </button>
        )}
      </div>
      <div className="glossary-terms-content" data-testid="glossary-container">
        {renderGlossaryTermsContent()}
      </div>
    </div>
  );
};

export default GlossaryTermsSectionV1;

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
import { ReactComponent as CloseIcon } from '../../../assets/svg/close-icon.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit.svg';
import { ReactComponent as GlossaryIcon } from '../../../assets/svg/glossary.svg';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import { getEntityName } from '../../../utils/EntityUtils';
import { fetchGlossaryList } from '../../../utils/TagsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import TagSelectForm from '../../Tag/TagsSelectForm/TagsSelectForm.component';
import './GlossaryTermsSection.less';

interface GlossaryTermsSectionProps {
  tags?: TagLabel[];
  showEditButton?: boolean;
  hasPermission?: boolean;
  entityId?: string;
  onGlossaryTermsUpdate?: (updatedTags: TagLabel[]) => void;
  maxVisibleGlossaryTerms?: number;
}

const GlossaryTermsSection: React.FC<GlossaryTermsSectionProps> = ({
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
  const [isLoading, setIsLoading] = useState(false);
  const [showAllTerms, setShowAllTerms] = useState(false);

  // Filter only glossary terms from tags
  const glossaryTerms = tags.filter((tag) => tag.source === TagSource.Glossary);

  const handleEditClick = () => {
    setEditingGlossaryTerms(glossaryTerms);
    setIsEditing(true);
  };

  // Save now happens via selection submit; no explicit save button

  const handleCancel = () => {
    setEditingGlossaryTerms(glossaryTerms);
    setIsEditing(false);
  };

  const handleGlossaryTermSelection = async (selectedOptions: unknown) => {
    try {
      setIsLoading(true);
      // TagSelectForm returns the selected options directly
      const options = Array.isArray(selectedOptions)
        ? selectedOptions
        : [selectedOptions];

      const newGlossaryTerms = options.map((option: unknown) => {
        const optionObj = option as Record<string, unknown>;

        let tagData: any = {
          tagFQN: (optionObj.value || option) as string,
          source: TagSource.Glossary,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        };

        // Extract additional data from option.data if available (same as TagsContainerV2)
        if (optionObj.data) {
          tagData = {
            ...tagData,
            name: (optionObj.data as any)?.name,
            displayName: (optionObj.data as any)?.displayName,
            description: (optionObj.data as any)?.description,
            style: (optionObj.data as any)?.style ?? {},
          };
        }

        return tagData;
      });

      // Create updated tags array by replacing glossary terms
      const nonGlossaryTags = tags.filter(
        (tag) => tag.source !== TagSource.Glossary
      );
      const updatedTags = [...nonGlossaryTags, ...newGlossaryTerms];

      // Call the callback to update parent component
      if (onGlossaryTermsUpdate) {
        await Promise.resolve(onGlossaryTermsUpdate(updatedTags));
      }

      setIsEditing(false);
      setIsLoading(false);
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
            <span className="edit-icon" onClick={handleEditClick}>
              <EditIcon />
            </span>
          )}
          {isEditing && !isLoading && (
            <div className="edit-actions">
              <span className="cancel-icon" onClick={handleCancel}>
                <CloseIcon />
              </span>
            </div>
          )}
        </div>
        <div
          className="glossary-terms-content"
          data-testid="glossary-container">
          {isLoading ? (
            <div className="glossary-terms-loading-container">
              <div className="glossary-terms-loading-spinner">
                <div className="loading-spinner" />
              </div>
            </div>
          ) : isEditing ? (
            <div className="inline-edit-container">
              <TagSelectForm
                defaultValue={editingGlossaryTerms.map((term) => term.tagFQN)}
                fetchApi={fetchGlossaryList}
                key={`glossary-terms-${entityId}`}
                placeholder={t('label.add-a-entity', {
                  entity: t('label.glossary-term'),
                })}
                tagType={TagSource.Glossary}
                onCancel={handleCancel}
                onSubmit={handleGlossaryTermSelection}
              />
            </div>
          ) : (
            <span className="no-data-placeholder">
              {t('label.no-data-found')}
            </span>
          )}
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
          <span className="edit-icon" onClick={handleEditClick}>
            <EditIcon />
          </span>
        )}
        {isEditing && !isLoading && (
          <div className="edit-actions">
            <span className="cancel-icon" onClick={handleCancel}>
              <CloseIcon />
            </span>
          </div>
        )}
      </div>
      <div className="glossary-terms-content" data-testid="glossary-container">
        {isLoading ? (
          <div className="glossary-terms-loading-container">
            <div className="glossary-terms-loading-spinner">
              <div className="loading-spinner" />
            </div>
          </div>
        ) : isEditing ? (
          <div className="inline-edit-container">
            <TagSelectForm
              defaultValue={editingGlossaryTerms.map((term) => term.tagFQN)}
              fetchApi={fetchGlossaryList}
              key={`glossary-terms-${entityId}`}
              placeholder={t('label.add-a-entity', {
                entity: t('label.glossary-term'),
              })}
              tagType={TagSource.Glossary}
              onCancel={handleCancel}
              onSubmit={handleGlossaryTermSelection}
            />
          </div>
        ) : (
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
                  key={index}>
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
        )}
      </div>
    </div>
  );
};

export default GlossaryTermsSection;

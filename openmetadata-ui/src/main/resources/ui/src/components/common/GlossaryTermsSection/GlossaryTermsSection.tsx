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
import { compare } from 'fast-json-patch';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../../assets/svg/close-icon.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit.svg';
import { ReactComponent as GlossaryIcon } from '../../../assets/svg/glossary.svg';
import { ReactComponent as TickIcon } from '../../../assets/svg/tick.svg';
import { EntityType } from '../../../enums/entity.enum';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import { patchChartDetails } from '../../../rest/chartsAPI';
import { patchDashboardDetails } from '../../../rest/dashboardAPI';
import { patchMlModelDetails } from '../../../rest/mlModelAPI';
import { patchPipelineDetails } from '../../../rest/pipelineAPI';
import { patchTableDetails } from '../../../rest/tableAPI';
import { patchTopicDetails } from '../../../rest/topicsAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { fetchGlossaryList } from '../../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import TagSelectForm from '../../Tag/TagsSelectForm/TagsSelectForm.component';
import './GlossaryTermsSection.less';

interface GlossaryTermsSectionProps {
  tags?: TagLabel[];
  showEditButton?: boolean;
  hasPermission?: boolean;
  entityId?: string;
  entityType?: EntityType;
  onGlossaryTermsUpdate?: (updatedTags: TagLabel[]) => void;
}

const GlossaryTermsSection: React.FC<GlossaryTermsSectionProps> = ({
  tags = [],
  showEditButton = true,
  hasPermission = false,
  entityId,
  entityType,
  onGlossaryTermsUpdate,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editingGlossaryTerms, setEditingGlossaryTerms] = useState<TagLabel[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);

  // Filter only glossary terms from tags
  const glossaryTerms = tags.filter((tag) => tag.source === TagSource.Glossary);

  // Function to get the correct patch API based on entity type
  const getPatchAPI = (entityType?: EntityType) => {
    switch (entityType) {
      case EntityType.TABLE:
        return patchTableDetails;
      case EntityType.DASHBOARD:
        return patchDashboardDetails;
      case EntityType.TOPIC:
        return patchTopicDetails;
      case EntityType.PIPELINE:
        return patchPipelineDetails;
      case EntityType.MLMODEL:
        return patchMlModelDetails;
      case EntityType.CHART:
        return patchChartDetails;
      default:
        // Default to table API for backward compatibility
        return patchTableDetails;
    }
  };

  const handleEditClick = () => {
    setEditingGlossaryTerms(glossaryTerms);
    setIsEditing(true);
  };

  const handleSave = useCallback(async () => {
    const idToUse = entityId;

    if (!idToUse) {
      showErrorToast(t('message.entity-id-required'));

      return;
    }

    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idToUse
      );

    if (!isUUID) {
      showErrorToast(t('message.invalid-entity-id'));

      return;
    }

    try {
      setIsLoading(true);

      // Create updated tags array by replacing glossary terms
      const nonGlossaryTags = tags.filter(
        (tag) => tag.source !== TagSource.Glossary
      );
      const updatedTags = [...nonGlossaryTags, ...editingGlossaryTerms];

      // Create JSON patch by comparing the tags arrays
      const currentData = { tags };
      const updatedData = { tags: updatedTags };
      const jsonPatch = compare(currentData, updatedData);

      // Only proceed if there are actual changes
      if (jsonPatch.length === 0) {
        setIsLoading(false);

        return;
      }

      // Make the API call using the correct patch API for the entity type
      const patchAPI = getPatchAPI(entityType);
      await patchAPI(idToUse, jsonPatch);

      // Show success message
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.glossary-term-plural'),
        })
      );

      // Call the callback to update parent component with the new tags
      if (onGlossaryTermsUpdate) {
        onGlossaryTermsUpdate(updatedTags);
      }

      // Keep loading state for a brief moment to ensure smooth transition
      setTimeout(() => {
        setIsEditing(false);
        setIsLoading(false);
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
  }, [
    entityId,
    entityType,
    tags,
    editingGlossaryTerms,
    onGlossaryTermsUpdate,
    t,
  ]);

  const handleCancel = () => {
    setEditingGlossaryTerms(glossaryTerms);
    setIsEditing(false);
  };

  const handleGlossaryTermSelection = async (selectedOptions: unknown) => {
    // TagSelectForm returns the selected options directly
    const options = Array.isArray(selectedOptions)
      ? selectedOptions
      : [selectedOptions];

    const newGlossaryTerms = options.map((option: unknown) => {
      const optionObj = option as Record<string, unknown>;

      return {
        tagFQN: (optionObj.value || option) as string,
        source: TagSource.Glossary,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      };
    });

    // Create updated tags array by replacing glossary terms
    const nonGlossaryTags = tags.filter(
      (tag) => tag.source !== TagSource.Glossary
    );
    const updatedTags = [...nonGlossaryTags, ...newGlossaryTerms];

    // Call the callback to update parent component
    if (onGlossaryTermsUpdate) {
      await onGlossaryTermsUpdate(updatedTags);
    }

    setIsEditing(false);
  };

  if (!glossaryTerms || !glossaryTerms.length) {
    return (
      <div className="glossary-terms-section">
        <div className="glossary-terms-header">
          <Typography.Text className="glossary-terms-title">
            {t('label.glossary-term-plural')}
          </Typography.Text>
          {showEditButton && hasPermission && !isEditing && !isLoading && (
            <span className="cursor-pointer" onClick={handleEditClick}>
              <EditIcon />
            </span>
          )}
          {isEditing && !isLoading && (
            <div className="edit-actions">
              <span className="cursor-pointer" onClick={handleCancel}>
                <CloseIcon />
              </span>
              <span className="cursor-pointer" onClick={handleSave}>
                <TickIcon />
              </span>
            </div>
          )}
        </div>
        <div className="glossary-terms-content">
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
                key={`glossary-terms-${entityId}-${isEditing}`}
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
    <div className="glossary-terms-section">
      <div className="glossary-terms-header">
        <Typography.Text className="glossary-terms-title">
          {t('label.glossary-term-plural')}
        </Typography.Text>
        {showEditButton && hasPermission && !isEditing && !isLoading && (
          <span className="cursor-pointer" onClick={handleEditClick}>
            <EditIcon />
          </span>
        )}
        {isEditing && !isLoading && (
          <div className="edit-actions">
            <span className="cursor-pointer" onClick={handleCancel}>
              <CloseIcon />
            </span>
            <span className="cursor-pointer" onClick={handleSave}>
              <TickIcon />
            </span>
          </div>
        )}
      </div>
      <div className="glossary-terms-content">
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
              key={`glossary-terms-${entityId}-${isEditing}`}
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
              {glossaryTerms.map((glossaryTerm, index) => (
                <div className="glossary-term-item" key={index}>
                  <GlossaryIcon className="glossary-term-icon" />
                  <span className="glossary-term-name">
                    {getEntityName(glossaryTerm)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlossaryTermsSection;

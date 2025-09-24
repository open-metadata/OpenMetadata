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
import { FolderOutlined, MinusOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../../assets/svg/close-icon.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit.svg';
import { ReactComponent as TickIcon } from '../../../assets/svg/tick.svg';
import { EntityType } from '../../../enums/entity.enum';
import { TagLabel } from '../../../generated/type/tagLabel';
import { patchApiCollection } from '../../../rest/apiCollectionsAPI';
import { patchApiEndPoint } from '../../../rest/apiEndpointsAPI';
import { patchChartDetails } from '../../../rest/chartsAPI';
import { patchDashboardDetails } from '../../../rest/dashboardAPI';
import {
  patchDatabaseDetails,
  patchDatabaseSchemaDetails,
} from '../../../rest/databaseAPI';
import { patchDataModelDetails } from '../../../rest/dataModelsAPI';
import { patchDataProduct } from '../../../rest/dataProductAPI';
import { patchMlModelDetails } from '../../../rest/mlModelAPI';
import { patchPipelineDetails } from '../../../rest/pipelineAPI';
import { patchSearchIndexDetails } from '../../../rest/SearchIndexAPI';
import { patchContainerDetails } from '../../../rest/storageAPI';
import { patchStoredProceduresDetails } from '../../../rest/storedProceduresAPI';
import { patchTableDetails } from '../../../rest/tableAPI';
import { patchTopicDetails } from '../../../rest/topicsAPI';
import tagClassBase from '../../../utils/TagClassBase';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import AsyncSelectList from '../AsyncSelectList/AsyncSelectList';
import { SelectOption } from '../AsyncSelectList/AsyncSelectList.interface';
import './TagsSection.less';
interface TagsSectionProps {
  tags?: TagLabel[];
  showEditButton?: boolean;
  maxDisplayCount?: number;
  hasPermission?: boolean;
  entityId?: string;
  entityType?: EntityType;
  onTagsUpdate?: (updatedTags: TagLabel[]) => void;
}

interface TagItem {
  id: string;
  name: string;
  displayName: string;
}

const TagsSection: React.FC<TagsSectionProps> = ({
  tags = [],
  showEditButton = true,
  maxDisplayCount = 3,
  hasPermission = false,
  entityId,
  entityType,
  onTagsUpdate,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTags, setEditingTags] = useState<TagItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const displayedTags = isExpanded ? tags : tags.slice(0, maxDisplayCount);
  const remainingCount = tags.length - maxDisplayCount;
  const shouldShowMore = remainingCount > 0 && !isExpanded;

  const getTagDisplayName = (tag: TagLabel) => {
    return tag.displayName || tag.name || tag.tagFQN || t('label.unknown');
  };

  const getTagStyle = (_tag: TagLabel, index: number) => {
    // Default styling for other tags
    return {
      backgroundColor: '#F9FAFC',
      borderColor: '#E3E8F0',
      color: '#262626',
    };
  };

  const convertToTagItems = (tags: TagLabel[]): TagItem[] => {
    return tags.map((tag) => ({
      id: tag.tagFQN || tag.displayName || '',
      name: tag.tagFQN || tag.displayName || '',
      displayName: tag.displayName || tag.tagFQN || '',
    }));
  };

  const convertToSelectOptions = (tags: TagItem[]): SelectOption[] => {
    return tags.map((tag) => ({
      label: tag.displayName,
      value: tag.name,
      data: {
        fullyQualifiedName: tag.name,
        name: tag.displayName,
        displayName: tag.displayName,
      } as any, // Type assertion to handle the data type mismatch
    }));
  };

  // Function to get the appropriate patch API based on entity type
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
      case EntityType.API_COLLECTION:
        return patchApiCollection;
      case EntityType.API_ENDPOINT:
        return patchApiEndPoint;
      case EntityType.DATABASE:
        return patchDatabaseDetails;
      case EntityType.DATABASE_SCHEMA:
        return patchDatabaseSchemaDetails;
      case EntityType.STORED_PROCEDURE:
        return patchStoredProceduresDetails;
      case EntityType.CONTAINER:
        return patchContainerDetails;
      case EntityType.DASHBOARD_DATA_MODEL:
        return patchDataModelDetails;
      case EntityType.SEARCH_INDEX:
        return patchSearchIndexDetails;
      case EntityType.DATA_PRODUCT:
        return patchDataProduct;
      default:
        // For entity types without specific patch APIs, throw an error
        throw new Error(
          `No patch API available for entity type: ${entityType}`
        );
    }
  };

  const handleEditClick = () => {
    setEditingTags(convertToTagItems(tags));
    setIsEditing(true);
  };

  const handleSaveWithTags = useCallback(
    async (tagsToSave: TagItem[]) => {
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

        // Convert TagItem[] to TagLabel[] format
        const updatedTags: TagLabel[] = tagsToSave.map((tag) => ({
          tagFQN: tag.name,
          displayName: tag.displayName,
          name: tag.displayName,
          source: 'Classification' as any,
          labelType: 'Manual' as any,
          state: 'Confirmed' as any,
        }));

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
            entity: t('label.tag-plural'),
          })
        );

        // Call the callback to update parent component with the new tags
        if (onTagsUpdate) {
          onTagsUpdate(updatedTags);
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
            entity: t('label.tag-lowercase-plural'),
          })
        );
      }
    },
    [entityId, entityType, tags, onTagsUpdate, t]
  );

  const handleSave = () => {
    handleSaveWithTags(editingTags);
  };

  const handleCancel = () => {
    setEditingTags(convertToTagItems(tags));
    setIsEditing(false);
  };

  const handleTagSelection = (selectedOptions: unknown) => {
    const options = Array.isArray(selectedOptions)
      ? selectedOptions
      : [selectedOptions];
    const newTags = options.map((option: any) => ({
      id: option.value,
      name: option.value,
      displayName: option.data?.displayName || option.label,
    }));
    setEditingTags(newTags);
  };

  if (!tags.length) {
    return (
      <div className="tags-section">
        <div className="tags-header">
          <Typography.Text className="tags-title">
            {t('label.tag-plural')}
          </Typography.Text>
          {showEditButton && hasPermission && !isEditing && !isLoading && (
            <span
              className="cursor-pointer"
              data-testid="edit-icon"
              onClick={handleEditClick}>
              <EditIcon />
            </span>
          )}
          {isEditing && !isLoading && (
            <div className="edit-actions">
              <span
                className="cursor-pointer"
                data-testid="close-icon"
                onClick={handleCancel}>
                <CloseIcon />
              </span>
              <span
                className="cursor-pointer"
                data-testid="tick-icon"
                onClick={handleSave}>
                <TickIcon />
              </span>
            </div>
          )}
        </div>
        <div className="tags-content">
          {isLoading ? (
            <div className="tags-loading-container">
              <div className="tags-loading-spinner">
                <div className="loading-spinner" />
              </div>
            </div>
          ) : isEditing ? (
            <div className="inline-edit-container">
              <AsyncSelectList
                newLook
                className="tag-selector"
                fetchOptions={tagClassBase.getTags}
                initialOptions={convertToSelectOptions(editingTags)}
                mode="multiple"
                placeholder={t('label.add-a-entity', {
                  entity: t('label.tag'),
                })}
                value={editingTags.map((tag) => tag.name)}
                onChange={handleTagSelection}
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
    <div className="tags-section">
      <div className="tags-header">
        <Typography.Text className="tags-title">
          {t('label.tag-plural')}
        </Typography.Text>
        {showEditButton && hasPermission && !isEditing && !isLoading && (
          <span
            className="cursor-pointer"
            data-testid="edit-icon"
            onClick={handleEditClick}>
            <EditIcon />
          </span>
        )}
        {isEditing && !isLoading && (
          <div className="edit-actions">
            <span
              className="cursor-pointer"
              data-testid="close-icon"
              onClick={handleCancel}>
              <CloseIcon />
            </span>
            <span
              className="cursor-pointer"
              data-testid="tick-icon"
              onClick={handleSave}>
              <TickIcon />
            </span>
          </div>
        )}
      </div>
      <div className="tags-content">
        {isLoading ? (
          <div className="tags-loading-container">
            <div className="tags-loading-spinner">
              <div className="loading-spinner" />
            </div>
          </div>
        ) : isEditing ? (
          <div className="inline-edit-container">
            <AsyncSelectList
              newLook
              className="tag-selector"
              fetchOptions={tagClassBase.getTags}
              initialOptions={convertToSelectOptions(editingTags)}
              mode="multiple"
              placeholder={t('label.add-a-entity', {
                entity: t('label.tag'),
              })}
              value={editingTags.map((tag) => tag.name)}
              onChange={handleTagSelection}
            />
          </div>
        ) : (
          <div className="tags-display">
            <div className="tags-list">
              {displayedTags.map((tag, index) => (
                <div
                  className="tag-item"
                  key={index}
                  style={getTagStyle(tag, index)}>
                  <FolderOutlined className="tag-icon" />
                  <MinusOutlined className="tag-minus-icon" />
                  <span className="tag-name">{getTagDisplayName(tag)}</span>
                </div>
              ))}
            </div>
            {shouldShowMore && (
              <Button
                className="show-more-button"
                size="small"
                type="link"
                onClick={() => setIsExpanded(true)}>
                {t('label.plus-count-more', { count: remainingCount })}
              </Button>
            )}
            {isExpanded && remainingCount > 0 && (
              <Button
                className="show-less-button"
                size="small"
                type="link"
                onClick={() => setIsExpanded(false)}>
                {t('label.show-less-lowercase')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagsSection;

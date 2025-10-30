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
import { ReactComponent as ClassificationIcon } from '../../../assets/svg/classification.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit.svg';
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
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { TagSelectableList } from '../TagSelectableList/TagSelectableList.component';
import './TagsSection.less';

interface TagsSectionProps {
  tags?: TagLabel[];
  showEditButton?: boolean;
  maxVisibleTags?: number;
  hasPermission?: boolean;
  entityId?: string;
  entityType?: EntityType;
  onTagsUpdate?: (updatedTags: TagLabel[]) => void;
}

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
  const [isEditing, setIsEditing] = useState(false);
  const [editingTags, setEditingTags] = useState<TagLabel[]>([]);
  const [displayTags, setDisplayTags] = useState<TagLabel[]>(tags);
  const [isLoading, setIsLoading] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  React.useEffect(() => {
    setDisplayTags((prev) => {
      if (JSON.stringify(prev) !== JSON.stringify(tags)) {
        return tags;
      }

      return prev;
    });
  }, [tags]);

  const getTagFqn = (tag: TagLabel) =>
    (tag.tagFQN || tag.name || tag.displayName || '').toString();

  const nonTierTags: TagLabel[] = (displayTags || []).filter(
    (t) => !getTagFqn(t).startsWith('Tier.')
  );
  const tierTags: TagLabel[] = (displayTags || []).filter((t) =>
    getTagFqn(t).startsWith('Tier.')
  );

  const getTagDisplayName = (tag: TagLabel) => {
    return tag.displayName || tag.name || tag.tagFQN || t('label.unknown');
  };

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
        throw new Error(
          `No patch API available for entity type: ${entityType}`
        );
    }
  };

  const handleEditClick = () => {
    setEditingTags(nonTierTags);
    setIsEditing(true);
    setPopoverOpen(true);
  };

  const handleSaveWithTags = useCallback(
    async (tagsToSave: TagLabel[]) => {
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

        const updatedTags: TagLabel[] = [...tierTags, ...tagsToSave];
        const currentData = { tags: displayTags };
        const updatedData = { tags: updatedTags };
        const jsonPatch = compare(currentData, updatedData);

        if (jsonPatch.length === 0) {
          setIsLoading(false);

          return;
        }

        const patchAPI = getPatchAPI(entityType);
        await patchAPI(idToUse, jsonPatch);

        setDisplayTags(updatedTags);

        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.tag-plural'),
          })
        );

        if (onTagsUpdate) {
          onTagsUpdate(updatedTags);
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
            entity: t('label.tag-lowercase-plural'),
          })
        );
      }
    },
    [entityId, entityType, displayTags, tierTags, onTagsUpdate, t]
  );

  const handleTagSelection = async (selectedTags: TagLabel[]) => {
    setEditingTags(selectedTags);
    await handleSaveWithTags(selectedTags);
  };

  const handlePopoverOpenChange = (open: boolean) => {
    setPopoverOpen(open);
    if (!open) {
      setIsEditing(false);
      setEditingTags(nonTierTags);
    }
  };

  const renderLoadingState = () => (
    <div className="tags-loading-container">
      <div className="tags-loading-spinner">
        <div className="loading-spinner" />
      </div>
    </div>
  );

  const renderEditingState = () => (
    <TagSelectableList
      hasPermission={hasPermission}
      popoverProps={{
        placement: 'bottomLeft',
        open: popoverOpen,
        onOpenChange: handlePopoverOpenChange,
        overlayClassName: 'tag-select-popover',
      }}
      selectedTags={editingTags}
      onCancel={() => {
        setPopoverOpen(false);
        setIsEditing(false);
      }}
      onUpdate={handleTagSelection}>
      <div className="d-none tag-selector-display">
        {editingTags.length > 0 && (
          <div className="selected-tags-list">
            {editingTags.map((tag) => (
              <div className="selected-tag-chip" key={tag.tagFQN}>
                <ClassificationIcon className="tag-icon" />
                <span className="tag-name">{getTagDisplayName(tag)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </TagSelectableList>
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

  const renderTagsDisplay = () => (
    <div className="tags-display">
      <div className="tags-list">
        {(showAllTags ? nonTierTags : nonTierTags.slice(0, maxVisibleTags)).map(
          (tag, index) => (
            <div className="tag-item" key={index}>
              <ClassificationIcon className="tag-icon" />
              <span className="tag-name">{getTagDisplayName(tag)}</span>
            </div>
          )
        )}
        {nonTierTags.length > maxVisibleTags && (
          <button
            className="show-more-tags-button"
            type="button"
            onClick={() => setShowAllTags(!showAllTags)}>
            {showAllTags
              ? t('label.less')
              : `+${nonTierTags.length - maxVisibleTags} ${t(
                  'label.more-lowercase'
                )}`}
          </button>
        )}
      </div>
    </div>
  );

  const renderTagsContent = () => {
    if (isLoading) {
      return renderLoadingState();
    }
    if (isEditing) {
      return renderEditingState();
    }

    return renderTagsDisplay();
  };

  if (!nonTierTags.length) {
    return (
      <div className="tags-section">
        <div className="tags-header">
          <Typography.Text className="tags-title">
            {t('label.tag-plural')}
          </Typography.Text>
          {showEditButton && hasPermission && !isEditing && !isLoading && (
            <span
              className="edit-icon"
              data-testid="edit-icon-tags"
              onClick={handleEditClick}>
              <EditIcon />
            </span>
          )}
        </div>
        <div className="tags-content">{renderEmptyContent()}</div>
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
            className="edit-icon"
            data-testid="edit-icon-tags"
            onClick={handleEditClick}>
            <EditIcon />
          </span>
        )}
      </div>
      <div className="tags-content">{renderTagsContent()}</div>
    </div>
  );
};

export default TagsSectionV1;

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
import { ReactComponent as EditIcon } from '../../../assets/svg/edit.svg';
import { TAG_START_WITH } from '../../../constants/Tag.constants';
import { EntityType } from '../../../enums/entity.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
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
import TagsV1 from '../../Tag/TagsV1/TagsV1.component';
import TierCard from '../TierCard/TierCard';
import { TierSectionProps } from './TierSection.interface';
import './TierSection.less';

const TierSection: React.FC<TierSectionProps> = ({
  tier,
  tags = [],
  showEditButton = true,
  hasPermission = false,
  entityId,
  entityType,
  onTierUpdate,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [displayTier, setDisplayTier] = useState<TagLabel | undefined>(tier);
  const [isLoading, setIsLoading] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  React.useEffect(() => {
    setDisplayTier((prev) => {
      // Only update if different
      if (JSON.stringify(prev) !== JSON.stringify(tier)) {
        return tier;
      }

      return prev;
    });
  }, [tier]);

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
    setIsEditing(true);
    setPopoverOpen(true);
  };

  const handleSaveWithTier = useCallback(
    async (selectedTier?: Tag) => {
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

        // Remove existing tier from tags and add new tier if provided
        const updatedTags = tags.filter(
          (tag) => !tag.tagFQN.startsWith('Tier.')
        );

        if (selectedTier) {
          updatedTags.push({
            tagFQN: selectedTier.fullyQualifiedName ?? '',
            name: selectedTier.name,
            description: selectedTier.description,
            source: TagSource.Classification,
            labelType: 'Manual',
            state: 'Confirmed',
          } as TagLabel);
        }

        // Create JSON patch by comparing the tags arrays
        const currentData = { tags };
        const updatedData = { tags: updatedTags };
        const jsonPatch = compare(currentData, updatedData);

        // Only proceed if there are actual changes
        if (jsonPatch.length === 0) {
          setIsLoading(false);
          setIsEditing(false);

          return;
        }

        // Make the API call using the correct patch API for the entity type
        const patchAPI = getPatchAPI(entityType);
        await patchAPI(idToUse, jsonPatch);

        const newTier = updatedTags.find((tag) =>
          tag.tagFQN.startsWith('Tier.')
        );

        setDisplayTier(newTier);

        // Show success message
        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.tier'),
          })
        );

        // Call the callback to update parent component with the new tier
        if (onTierUpdate) {
          onTierUpdate(newTier);
        }

        // Keep loading state for a brief moment to ensure smooth transition
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
            entity: t('label.tier-lowercase'),
          })
        );
      }
    },
    [entityId, entityType, tags, onTierUpdate, t]
  );

  const handleCancel = () => {
    setIsEditing(false);
    setPopoverOpen(false);
  };

  const handleTierSelection = async (selectedTier?: Tag) => {
    // Call API immediately like the existing system
    await handleSaveWithTier(selectedTier);
  };

  return (
    <div className="tier-section">
      <div className="tier-header">
        <Typography.Text className="tier-title">
          {t('label.tier')}
        </Typography.Text>
        {showEditButton && hasPermission && !isEditing && !isLoading && (
          <span
            className="edit-icon"
            data-testid="edit-icon-tier"
            onClick={handleEditClick}>
            <EditIcon />
          </span>
        )}
      </div>
      <div className="tier-content">
        {isLoading ? (
          <div className="tier-loading-container">
            <div className="tier-loading-spinner">
              <div className="loading-spinner" />
            </div>
          </div>
        ) : isEditing ? (
          <TierCard
            currentTier={displayTier?.tagFQN}
            footerActionButtonsClassName="tier-card-footer-action-buttons"
            popoverProps={{ open: popoverOpen }}
            tierCardClassName="tier-card-popover"
            updateTier={handleTierSelection}
            onClose={handleCancel}>
            <div className="tier-selector-display">
              {displayTier && (
                <div className="d-flex flex-col gap-2">
                  <TagsV1
                    hideIcon
                    startWith={TAG_START_WITH.SOURCE_ICON}
                    tag={displayTier}
                    tagProps={{
                      'data-testid': 'Tier',
                    }}
                  />
                </div>
              )}
            </div>
          </TierCard>
        ) : (
          <div className="tier-display">
            {displayTier ? (
              <div className="d-flex flex-col gap-2">
                <TagsV1
                  hideIcon
                  startWith={TAG_START_WITH.SOURCE_ICON}
                  tag={displayTier}
                  tagProps={{
                    'data-testid': 'Tier',
                  }}
                />
              </div>
            ) : (
              <span className="no-data-placeholder">
                {t('label.no-data-found')}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TierSection;

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
import { get, isEmpty } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../../assets/svg/close-icon.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit.svg';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import {
  getAPIfromSource,
  getEntityAPIfromSource,
} from '../../../utils/Assets/AssetsUtils';
import { getDomainIcon } from '../../../utils/DomainUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { AssetsUnion } from '../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import DomainSelectableList from '../DomainSelectableList/DomainSelectableList.component';
import './DomainsSection.less';
interface DomainsSectionProps {
  domains?: EntityReference[];
  showEditButton?: boolean;
  entityType?: EntityType;
  entityFqn?: string;
  entityId?: string;
  hasPermission?: boolean;
  onDomainUpdate?: (updatedDomains: EntityReference[]) => void;
  maxVisibleDomains?: number;
}

const DomainsSection: React.FC<DomainsSectionProps> = ({
  domains,
  showEditButton = true,
  entityType,
  entityFqn,
  entityId,
  hasPermission = false,
  onDomainUpdate,
  maxVisibleDomains = 3,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editingDomains, setEditingDomains] = useState<EntityReference[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeDomains, setActiveDomains] = useState<EntityReference[]>([]);
  const [showAllDomains, setShowAllDomains] = useState(false);

  // Sync activeDomains with domains prop, similar to DomainLabel
  useEffect(() => {
    const nextActiveDomains = domains
      ? Array.isArray(domains)
        ? domains
        : [domains]
      : [];

    setActiveDomains((prev) => {
      if (
        prev.length === nextActiveDomains.length &&
        prev.every((item, index) => item === nextActiveDomains[index])
      ) {
        return prev;
      }

      return nextActiveDomains;
    });
  }, [domains]);

  const handleEditClick = () => {
    setEditingDomains(activeDomains);
    setIsEditing(true);
  };

  const handleSaveWithDomains = useCallback(
    async (domainsToSave: EntityReference[]) => {
      if (!entityId || !entityType || !entityFqn) {
        showErrorToast(t('message.entity-details-required'));

        return;
      }

      try {
        setIsLoading(true);

        // Get current entity details
        const entityDetails = getEntityAPIfromSource(entityType as AssetsUnion)(
          entityFqn,
          { fields: 'domains' }
        );

        const entityDetailsResponse = await entityDetails;

        if (entityDetailsResponse) {
          // Create JSON patch by comparing the full entity objects, similar to DomainLabel
          const jsonPatch = compare(entityDetailsResponse, {
            ...entityDetailsResponse,
            domains: Array.isArray(domainsToSave)
              ? domainsToSave
              : domainsToSave
              ? [domainsToSave]
              : [],
          });

          // Only proceed if there are actual changes
          if (jsonPatch.length === 0) {
            setIsLoading(false);

            return;
          }

          // Make the API call
          const api = getAPIfromSource(entityType as AssetsUnion);
          const res = await api(entityId, jsonPatch);

          // Update internal state with the response, similar to DomainLabel
          const entityDomains = get(res, 'domains', {});

          if (Array.isArray(entityDomains)) {
            setActiveDomains(entityDomains);
          } else {
            const newActiveDomains = isEmpty(entityDomains)
              ? []
              : [entityDomains];
            setActiveDomains(newActiveDomains);
          }

          // Show success message
          showSuccessToast(
            t('server.update-entity-success', {
              entity: t('label.domain-plural'),
            })
          );

          // Call the callback to update parent component with the new domains
          if (onDomainUpdate) {
            onDomainUpdate(domainsToSave);
          }

          // Keep loading state for a brief moment to ensure smooth transition
          setTimeout(() => {
            setIsEditing(false);
            setIsLoading(false);
          }, 500);
        }
      } catch (error) {
        setIsLoading(false);
        showErrorToast(
          error as AxiosError,
          t('server.entity-updating-error', {
            entity: t('label.domain-lowercase-plural'),
          })
        );
      }
    },
    [entityId, entityType, entityFqn, domains, onDomainUpdate, t]
  );

  const handleCancel = () => {
    setEditingDomains(activeDomains);
    setIsEditing(false);
  };

  const handleDomainSelection = async (
    selectedDomains: EntityReference | EntityReference[] | undefined
  ) => {
    // Handle empty selection case
    let domainsArray: EntityReference[] = [];

    if (selectedDomains) {
      if (Array.isArray(selectedDomains)) {
        domainsArray = selectedDomains;
      } else {
        domainsArray = [selectedDomains];
      }
    }
    // If selectedDomains is undefined, domainsArray remains empty []

    setEditingDomains(domainsArray);

    // Call API immediately like the existing system
    await handleSaveWithDomains(domainsArray);
  };

  if (!activeDomains.length) {
    return (
      <div className="domains-section">
        <div className="domains-header">
          <Typography.Text className="domains-title">
            {t('label.domain-plural')}
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
        <div className="domains-content">
          {isLoading ? (
            <div className="domains-loading-container">
              <div className="domains-loading-spinner">
                <div className="loading-spinner" />
              </div>
            </div>
          ) : isEditing ? (
            <div className="inline-edit-container">
              <DomainSelectableList
                multiple
                hasPermission={hasPermission}
                overlayClassName="w-auto"
                popoverProps={{ placement: 'bottomLeft' }}
                selectedDomain={editingDomains}
                wrapInButton={false}
                onUpdate={handleDomainSelection}>
                <div className="domain-selector-display">
                  {editingDomains.length > 0 ? (
                    <div className="selected-domains-list">
                      {editingDomains.map((domain) => (
                        <div className="selected-domain-chip" key={domain.id}>
                          <span className="domain-name">
                            {domain.displayName || domain.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="domain-placeholder">
                      {t('label.select-entity', {
                        entity: t('label.domain-plural'),
                      })}
                    </span>
                  )}
                </div>
              </DomainSelectableList>
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
    <div className="domains-section">
      <div className="domains-header">
        <Typography.Text className="domains-title">
          {t('label.domain-plural')}
        </Typography.Text>
        {showEditButton && !isEditing && !isLoading && (
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
      <div className="domains-content">
        {isLoading ? (
          <div className="domains-loading-container">
            <div className="domains-loading-spinner">
              <div className="loading-spinner" />
            </div>
          </div>
        ) : isEditing ? (
          <div className="inline-edit-container">
            <DomainSelectableList
              multiple
              hasPermission={hasPermission}
              overlayClassName="w-auto"
              popoverProps={{ placement: 'bottomLeft' }}
              selectedDomain={editingDomains}
              wrapInButton={false}
              onUpdate={handleDomainSelection}>
              <div className="domain-selector-display">
                {editingDomains.length > 0 ? (
                  <div className="selected-domains-list">
                    {editingDomains.map((domain) => (
                      <div className="selected-domain-chip" key={domain.id}>
                        <span className="domain-name">
                          {domain.displayName || domain.name}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="domain-placeholder">
                    {t('label.select-entity', {
                      entity: t('label.domain-plural'),
                    })}
                  </span>
                )}
              </div>
            </DomainSelectableList>
          </div>
        ) : (
          <div className="domains-display">
            <div className="domains-list">
              {(showAllDomains
                ? activeDomains
                : activeDomains.slice(0, maxVisibleDomains)
              ).map((domain, index) => {
                const domainWithStyle = domain as EntityReference & {
                  style?: { color?: string; iconURL?: string };
                };

                return (
                  <div className="domain-item" key={index}>
                    <div className="domain-card-bar">
                      <div className="domain-card-content">
                        <div className="domain-card-icon">
                          {getDomainIcon(domainWithStyle?.style?.iconURL)}
                        </div>
                        <span className="domain-name">
                          {getEntityName(domain)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {activeDomains.length > maxVisibleDomains && (
                <button
                  className="show-more-domains-button"
                  type="button"
                  onClick={() => setShowAllDomains(!showAllDomains)}>
                  {showAllDomains
                    ? t('label.less')
                    : `+${activeDomains.length - maxVisibleDomains} ${t(
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

export default DomainsSection;

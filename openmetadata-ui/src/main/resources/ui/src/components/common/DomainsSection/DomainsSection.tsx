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
import { Typography } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { get, isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { useEntityRules } from '../../../hooks/useEntityRules';
import {
  getAPIfromSource,
  getEntityAPIfromSource,
} from '../../../utils/Assets/AssetsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { AssetsUnion } from '../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import DomainSelectableList from '../DomainSelectableList/DomainSelectableList.component';
import DomainTags from '../DomainTags/DomainTags';
import Loader from '../Loader/Loader';
import './DomainsSection.less';

interface DomainsSectionProps {
  domains?: EntityReference[];
  showEditButton?: boolean;
  entityType: EntityType;
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
  const [isLoading, setIsLoading] = useState(false);
  const [activeDomains, setActiveDomains] = useState<EntityReference[]>([]);
  const { entityRules } = useEntityRules(entityType);

  // Sync activeDomains with domains prop, similar to DomainLabel
  useEffect(() => {
    let nextActiveDomains: EntityReference[] = [];

    if (domains) {
      if (Array.isArray(domains)) {
        nextActiveDomains = domains;
      } else {
        nextActiveDomains = [domains];
      }
    }

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

  const updateActiveDomains = (
    entityDomains: EntityReference | EntityReference[] | Record<string, never>
  ) => {
    if (Array.isArray(entityDomains)) {
      setActiveDomains(entityDomains);

      return;
    }

    const newActiveDomains = isEmpty(entityDomains)
      ? []
      : [entityDomains as EntityReference];
    setActiveDomains(newActiveDomains);
  };

  const handleDomainSave = useCallback(
    async (selectedDomain: EntityReference | EntityReference[]) => {
      if (!entityId || !entityType || !entityFqn) {
        showErrorToast(t('message.entity-details-required'));

        return;
      }

      try {
        setIsLoading(true);

        const entityDetails = getEntityAPIfromSource(entityType as AssetsUnion)(
          entityFqn,
          { fields: 'domains' }
        );

        const entityDetailsResponse = await entityDetails;

        if (!entityDetailsResponse) {
          setIsLoading(false);

          return;
        }

        let domainsToSave: EntityReference[];
        if (Array.isArray(selectedDomain)) {
          domainsToSave = selectedDomain;
        } else if (isEmpty(selectedDomain)) {
          domainsToSave = [];
        } else {
          domainsToSave = [selectedDomain];
        }

        // Create JSON patch
        const jsonPatch = compare(entityDetailsResponse, {
          ...entityDetailsResponse,
          domains: domainsToSave,
        });

        // Only proceed if there are changes
        if (jsonPatch.length === 0) {
          setIsLoading(false);

          return;
        }

        // Make the API call
        const api = getAPIfromSource(entityType as AssetsUnion);
        const res = await api(entityId, jsonPatch);

        // Update internal state
        const entityDomains = get(res, 'domains', {});
        updateActiveDomains(entityDomains);

        // Show success message
        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.domain-plural'),
          })
        );

        // Call the callback
        if (onDomainUpdate) {
          onDomainUpdate(domainsToSave);
        }

        setIsLoading(false);
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
    [entityId, entityType, entityFqn, onDomainUpdate, t]
  );

  const loadingState = useMemo(() => <Loader size="small" />, []);

  const domainsDisplay = useMemo(
    () => (
      <div className="domains-display">
        <DomainTags domains={activeDomains} maxVisible={maxVisibleDomains} />
      </div>
    ),
    [activeDomains, maxVisibleDomains]
  );

  const selectableList = useMemo(() => {
    return (
      showEditButton &&
      hasPermission && (
        <DomainSelectableList
          hasPermission={hasPermission}
          multiple={entityRules.canAddMultipleDomains}
          overlayClassName="domain-popover"
          selectedDomain={activeDomains}
          wrapInButton={false}
          onUpdate={handleDomainSave}
        />
      )
    );
  }, [showEditButton, hasPermission, activeDomains, handleDomainSave]);

  if (isLoading) {
    return (
      <div className="domains-section">
        <div className="domains-header">
          <Typography className="domains-title">
            {t('label.domain-plural')}
          </Typography>
        </div>
        <div className="domains-content">{loadingState}</div>
      </div>
    );
  }

  if (!activeDomains.length) {
    return (
      <div className="domains-section">
        <div className="domains-header">
          <Typography className="domains-title">
            {t('label.domain-plural')}
          </Typography>
          {selectableList}
        </div>
        <div className="domains-content">
          <span className="no-data-placeholder">
            {t('label.no-entity-assigned', {
              entity: t('label.domain-plural'),
            })}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="domains-section">
      <div className="domains-header">
        <Typography className="domains-title">
          {t('label.domain-plural')}
        </Typography>
        {selectableList}
      </div>
      <div className="domains-content">{domainsDisplay}</div>
    </div>
  );
};

export default DomainsSection;

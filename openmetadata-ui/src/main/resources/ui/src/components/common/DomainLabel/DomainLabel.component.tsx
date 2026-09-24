/*
 *  Copyright 2023 Collate.
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
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { get, isEmpty, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/type';
import {
  getAPIfromSource,
  getEntityAPIfromSource,
} from '../../../utils/Assets/AssetsUtils';
import { getDomainsContentKey } from '../../../utils/DomainSyncUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AssetsUnion } from '../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { DataAssetWithDomains } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import DomainSelectableList from '../DomainSelectableList/DomainSelectableList.component';
import DomainTags from '../DomainTags/DomainTags';
import './domain-label.less';
import { DomainLabelProps } from './DomainLabel.interface';

export const DomainLabel = ({
  showDashPlaceholder,
  afterDomainUpdateAction,
  hasPermission,
  domains,
  domainDisplayName,
  entityType,
  entityFqn,
  entityId,
  textClassName,
  showDomainHeading = false,
  multiple = false,
  headerLayout = false,
  onUpdate,
}: DomainLabelProps) => {
  const { t } = useTranslation();
  const [activeDomain, setActiveDomain] = useState<EntityReference[]>([]);

  const defaultDomainText = useMemo(() => {
    return showDashPlaceholder
      ? NO_DATA_PLACEHOLDER
      : t('label.no-entity', { entity: t('label.domain-plural') });
  }, [showDashPlaceholder]);

  const handleDomainSave = useCallback(
    async (selectedDomain: EntityReference | EntityReference[]) => {
      const entityDetails = getEntityAPIfromSource(entityType as AssetsUnion)(
        entityFqn,
        { fields: 'domains' }
      );

      try {
        const entityDetailsResponse = await entityDetails;
        if (entityDetailsResponse) {
          let domains: EntityReference[];
          if (Array.isArray(selectedDomain)) {
            domains = selectedDomain;
          } else if (isEmpty(selectedDomain)) {
            domains = [];
          } else {
            domains = [selectedDomain];
          }
          const jsonPatch = compare(entityDetailsResponse, {
            ...entityDetailsResponse,
            domains,
          });

          const api = getAPIfromSource(entityType as AssetsUnion);
          const res = await api(entityId, jsonPatch);

          const entityDomains = get(res, 'domains', {});
          if (Array.isArray(entityDomains)) {
            setActiveDomain(entityDomains);
          } else {
            // update the domain details here
            setActiveDomain(isEmpty(entityDomains) ? [] : [entityDomains]);
          }
          !isUndefined(afterDomainUpdateAction) &&
            afterDomainUpdateAction(res as DataAssetWithDomains);
        }
      } catch (err) {
        // Handle errors as needed
        showErrorToast(err as AxiosError);
      }
    },
    [entityType, entityId, entityFqn, afterDomainUpdateAction, onUpdate]
  );

  useEffect(() => {
    let nextDomains: EntityReference[] = [];
    if (Array.isArray(domains)) {
      nextDomains = domains;
    } else if (domains) {
      nextDomains = [domains];
    }

    // `domains` arrives as a fresh array reference on every context re-render.
    // Setting state unconditionally churns `activeDomain`'s identity, remounting
    // the DomainSelectableList subtree and collapsing an open picker
    // mid-interaction. Only commit when the referenced domains actually changed;
    // return the previous reference otherwise so React bails out of the update.
    setActiveDomain((prev) =>
      getDomainsContentKey(prev) === getDomainsContentKey(nextDomains)
        ? prev
        : nextDomains
    );
  }, [domains]);

  const domainLink = useMemo(() => {
    if (!isEmpty(activeDomain)) {
      return (
        <DomainTags
          domains={activeDomain}
          labels={
            Array.isArray(domainDisplayName) ? domainDisplayName : undefined
          }
          maxVisible={headerLayout && multiple ? 1 : activeDomain.length}
        />
      );
    }

    return (
      <Typography
        className={classNames(
          'domain-link-text',
          { 'font-medium text-sm': !showDomainHeading },
          textClassName
        )}
        data-testid="no-domain-text">
        {defaultDomainText}
      </Typography>
    );
  }, [
    activeDomain,
    domainDisplayName,
    showDomainHeading,
    textClassName,
    multiple,
    headerLayout,
    defaultDomainText,
  ]);

  const selectableList = useMemo(() => {
    return (
      hasPermission && (
        <DomainSelectableList
          hasPermission={Boolean(hasPermission)}
          multiple={multiple}
          selectedDomain={activeDomain}
          wrapInButton={false}
          onUpdate={onUpdate ?? handleDomainSave}
        />
      )
    );
  }, [hasPermission, activeDomain, handleDomainSave, multiple, onUpdate]);

  const label = useMemo(() => {
    if (showDomainHeading) {
      return (
        <>
          <div
            className="d-flex text-sm  font-medium items-center m-b-xs"
            data-testid="header-domain-container">
            {!headerLayout ? (
              <Typography className="right-panel-label m-r-xss">
                {t('label.domain-plural')}
              </Typography>
            ) : (
              <Typography className="domain-link right-panel-label m-r-xss">
                {activeDomain.length > 0
                  ? t('label.domain-plural')
                  : defaultDomainText}
              </Typography>
            )}
            {selectableList}
          </div>

          <div className="d-flex  text-sm font-medium items-center gap-2 flex-wrap">
            {domainLink}
          </div>
        </>
      );
    }

    return (
      <div className="d-flex flex-col gap-2 justify-start">
        {headerLayout && (
          <div
            className="d-flex text-sm gap-1 font-medium items-center "
            data-testid="header-domain-container">
            <Typography className="domain-link right-panel-label m-r-xss">
              {t('label.domain-plural')}
            </Typography>
            {selectableList}
          </div>
        )}

        <div
          className="d-flex no-underline items-center gap-2 flex-wrap"
          data-testid="header-domain-container">
          {domainLink}
          {!headerLayout && selectableList}
        </div>
      </div>
    );
  }, [activeDomain, hasPermission, selectableList]);

  return label;
};

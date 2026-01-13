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
import { Divider, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { get, isEmpty, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import { ReactComponent as InheritIcon } from '../../../assets/svg/ic-inherit.svg';

import { EntityReference } from '../../../generated/entity/type';
import { useAuth } from '../../../hooks/authHooks';
import {
  getAPIfromSource,
  getEntityAPIfromSource,
} from '../../../utils/Assets/AssetsUtils';
import { renderDomainLink } from '../../../utils/DomainUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AssetsUnion } from '../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { DataAssetWithDomains } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import DomainSelectableListNew from '../DomainSelectableList/DomainSelectableListNew.component';
import { DomainLabelProps } from './DomainLabel.interface';

export const DomainLabelNew = ({
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
  onUpdate,
  userData,
}: DomainLabelProps) => {
  const { t } = useTranslation();
  const [activeDomain, setActiveDomain] = useState<EntityReference[]>([]);
  const isAdminUser = useAuth();
  const [showAll, setShowAll] = useState<boolean>(false);

  const handleDomainSave = useCallback(
    async (selectedDomain: EntityReference | EntityReference[]) => {
      const entityDetails = getEntityAPIfromSource(entityType as AssetsUnion)(
        entityFqn,
        { fields: 'domains' }
      );

      try {
        const entityDetailsResponse = await entityDetails;
        if (entityDetailsResponse) {
          const jsonPatch = compare(entityDetailsResponse, {
            ...entityDetailsResponse,
            domains: Array.isArray(selectedDomain)
              ? selectedDomain
              : [selectedDomain],
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
    if (domains) {
      if (Array.isArray(domains)) {
        setActiveDomain(domains);
      } else {
        setActiveDomain([domains]);
      }
    }
  }, [domains]);

  const domainLink = useMemo(() => {
    if (
      activeDomain &&
      Array.isArray(activeDomain) &&
      activeDomain.length > 0
    ) {
      const displayDomains = showAll ? activeDomain : activeDomain.slice(0, 5);
      const remainingCount = activeDomain.length - 5;

      return (
        <div className="d-flex flex-col gap-1 items-start">
          <div className="d-flex gap-1 flex-wrap flex-col">
            {displayDomains.map((domain) => {
              const inheritedIcon = domain?.inherited ? (
                <Tooltip
                  title={t('label.inherited-entity', {
                    entity: t('label.domain-plural'),
                  })}>
                  <span className="inherit-icon-container d-flex items-center flex-center">
                    <InheritIcon className="inherit-icon" height={8} />
                  </span>
                </Tooltip>
              ) : null;

              return (
                <div className="d-flex gap-1" key={domain.id}>
                  {renderDomainLink(
                    domain,
                    domainDisplayName,
                    showDomainHeading,
                    'chip-tag-link',
                    true
                  )}
                  {inheritedIcon && (
                    <div className="d-flex">{inheritedIcon}</div>
                  )}
                </div>
              );
            })}
          </div>
          {remainingCount > 0 && (
            <Typography.Text
              className="text-primary text-xs cursor-pointer"
              data-testid="show-all-domains"
              onClick={(e) => {
                e.stopPropagation();
                setShowAll(!showAll);
              }}>
              {showAll ? t('label.show-less') : `+${remainingCount} more`}
            </Typography.Text>
          )}
        </div>
      );
    } else {
      return (
        <Typography.Text
          className={classNames('text-sm no-data-chip-placeholder')}
          data-testid="no-domain-text">
          {t('label.no-entity', { entity: t('label.domain-plural') })}
        </Typography.Text>
      );
    }
  }, [
    activeDomain,
    domainDisplayName,
    showDomainHeading,
    textClassName,
    showAll,
  ]);

  const label = useMemo(() => {
    return (
      <div
        className="d-flex flex-col items-start gap-1 flex-wrap justify-center"
        data-testid="header-domain-container">
        {domainLink}
      </div>
    );
  }, [domainLink]);

  const selectableList = useMemo(() => {
    return (
      hasPermission && (
        <DomainSelectableListNew
          hasPermission={Boolean(isAdminUser) && !userData?.deleted}
          multiple={multiple}
          selectedDomain={activeDomain}
          onUpdate={onUpdate ?? handleDomainSave}
        />
      )
    );
  }, [hasPermission, activeDomain, handleDomainSave]);

  return (
    <div className="d-flex flex-col mb-4 w-full p-[20px] user-profile-card">
      <div className="user-profile-card-header d-flex items-center justify-start gap-2 w-full">
        <div style={{ width: '16px' }}>
          <DomainIcon height={16} style={{ marginLeft: '2px' }} />
        </div>

        <div className="d-flex justify-between w-full">
          <Typography.Text className="text-sm font-medium p-l-xss">
            {t('label.domain-plural')}
          </Typography.Text>
          {selectableList}
        </div>
      </div>
      <div className="user-profile-card-body d-flex justify-start gap-2">
        <div className="user-page-icon d-flex-center">
          <Divider
            style={{
              height: '100%',
              width: '1px',
              background: '#D9D9D9',
            }}
            type="vertical"
          />
        </div>
        {label}
      </div>
    </div>
  );
};

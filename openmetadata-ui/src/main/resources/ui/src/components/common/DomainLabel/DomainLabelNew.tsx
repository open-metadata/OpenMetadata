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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import { ReactComponent as InheritIcon } from '../../../assets/svg/ic-inherit.svg';

import { EntityReference } from '../../../generated/entity/type';
import {
  getAPIfromSource,
  getEntityAPIfromSource,
} from '../../../utils/Assets/AssetsUtils';
import {
  getDomainFieldFromEntityType,
  renderDomainLink,
} from '../../../utils/DomainUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AssetsUnion } from '../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { DataAssetWithDomains } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import DomainSelectableList from '../DomainSelectableList/DomainSelectableList.component';
import { DomainLabelProps } from './DomainLabel.interface';

export const DomainLabelNew = ({
  afterDomainUpdateAction,
  hasPermission,
  domain,
  domainDisplayName,
  entityType,
  entityFqn,
  entityId,
  textClassName,
  showDomainHeading = false,
  multiple = false,
  onUpdate,
}: DomainLabelProps) => {
  const { t } = useTranslation();
  const [activeDomain, setActiveDomain] = useState<EntityReference[]>([]);

  const handleDomainSave = useCallback(
    async (selectedDomain: EntityReference | EntityReference[]) => {
      const fieldData = getDomainFieldFromEntityType(entityType);

      const entityDetails = getEntityAPIfromSource(entityType as AssetsUnion)(
        entityFqn,
        { fields: fieldData }
      );

      try {
        const entityDetailsResponse = await entityDetails;
        if (entityDetailsResponse) {
          const jsonPatch = compare(entityDetailsResponse, {
            ...entityDetailsResponse,
            [fieldData]: selectedDomain,
          });

          const api = getAPIfromSource(entityType as AssetsUnion);
          const res = await api(entityId, jsonPatch);

          const entityDomains = get(res, fieldData, {});
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
    if (domain) {
      if (Array.isArray(domain)) {
        setActiveDomain(domain);
      } else {
        setActiveDomain([domain]);
      }
    }
  }, [domain]);

  const domainLink = useMemo(() => {
    if (
      activeDomain &&
      Array.isArray(activeDomain) &&
      activeDomain.length > 0
    ) {
      return activeDomain.map((domain) => {
        const inheritedIcon = domain?.inherited ? (
          <Tooltip
            title={t('label.inherited-entity', {
              entity: t('label.domain'),
            })}>
            <InheritIcon className="inherit-icon cursor-pointer" width={14} />
          </Tooltip>
        ) : null;

        return (
          <div className="d-flex items-center gap-1" key={domain.id}>
            {renderDomainLink(
              domain,
              domainDisplayName,
              showDomainHeading,
              textClassName
            )}
            {inheritedIcon && <div className="d-flex">{inheritedIcon}</div>}
          </div>
        );
      });
    } else {
      return (
        <Typography.Text
          className={classNames(
            'domain-link',
            { 'font-medium text-xs': !showDomainHeading },
            textClassName
          )}
          data-testid="no-domain-text">
          {t('label.no-entity', { entity: t('label.domain') })}
        </Typography.Text>
      );
    }
  }, [activeDomain, domainDisplayName, showDomainHeading, textClassName]);

  const selectableList = useMemo(() => {
    return (
      hasPermission && (
        <DomainSelectableList
          domains={domain as any}
          hasPermission={Boolean(hasPermission)}
          multiple={multiple}
          selectedDomain={activeDomain}
          onUpdate={onUpdate ?? handleDomainSave}
        />
      )
    );
  }, [hasPermission, activeDomain, handleDomainSave]);

  const label = useMemo(() => {
    return (
      <div
        className="d-flex flex-col items-center gap-1 flex-wrap"
        data-testid="header-domain-container">
        {domainLink}
      </div>
    );
  }, [activeDomain, hasPermission, selectableList]);

  return (
    <div className="d-flex flex-col mb-4 w-full h-full p-[20px] user-profile-card">
      <div className="user-profile-card-header d-flex items-center justify-start gap-2 w-full">
        <div style={{ width: '16px' }}>
          <DomainIcon height={16} style={{ marginLeft: '2px' }} />
        </div>

        <div className="d-flex justify-between w-full">
          <Typography.Text className="user-profile-card-title">
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

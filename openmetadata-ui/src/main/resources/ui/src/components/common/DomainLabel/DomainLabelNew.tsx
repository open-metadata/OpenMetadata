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
import { Divider, Typography } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { get, isEmpty, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import { EntityReference } from '../../../generated/entity/type';
import { useAuth } from '../../../hooks/authHooks';
import {
  getAPIfromSource,
  getEntityAPIfromSource,
} from '../../../utils/Assets/AssetsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AssetsUnion } from '../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { DataAssetWithDomains } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import DomainSelectableList from '../DomainSelectableList/DomainSelectableList.component';
import DomainTags from '../DomainTags/DomainTags';
import { DomainLabelProps } from './DomainLabel.interface';

export const DomainLabelNew = ({
  afterDomainUpdateAction,
  hasPermission,
  domains,
  entityType,
  entityFqn,
  entityId,
  multiple = false,
  onUpdate,
  userData,
}: DomainLabelProps) => {
  const { t } = useTranslation();
  const [activeDomain, setActiveDomain] = useState<EntityReference[]>([]);
  const isAdminUser = useAuth();

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

  const label = useMemo(() => {
    return (
      <div
        className="d-flex flex-col items-start gap-1 flex-wrap justify-center"
        data-testid="header-domain-container">
        <DomainTags domains={activeDomain} />
      </div>
    );
  }, [activeDomain]);

  const selectableList = useMemo(() => {
    return (
      hasPermission && (
        <DomainSelectableList
          hasPermission={Boolean(isAdminUser) && !userData?.deleted}
          multiple={multiple}
          selectedDomain={activeDomain}
          onUpdate={onUpdate ?? handleDomainSave}
        />
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPermission, activeDomain, handleDomainSave, isAdminUser, userData]);

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

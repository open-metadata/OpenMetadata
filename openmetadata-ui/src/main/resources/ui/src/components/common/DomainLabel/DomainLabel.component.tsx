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
import { Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import { AssetsUnion } from '../../../components/Assets/AssetsSelectionModal/AssetSelectionModal.interface';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/type';
import {
  getAPIfromSource,
  getEntityAPIfromSource,
} from '../../../utils/Assets/AssetsUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getDomainPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import DomainSelectableList from '../DomainSelectableList/DomainSelectableList.component';
import { DomainLabelProps } from './DomainLabel.interface';

export const DomainLabel = ({
  afterDomainUpdateAction,
  hasPermission,
  domain,
  domainDisplayName,
  entityType,
  entityFqn,
  entityId,
}: DomainLabelProps) => {
  const { t } = useTranslation();
  const [activeDomain, setActiveDomain] = useState<EntityReference>();

  const handleDomainSave = useCallback(
    async (selectedDomain: EntityReference) => {
      const entityDetails = getEntityAPIfromSource(entityType as AssetsUnion)(
        entityFqn,
        'domain'
      );

      try {
        const entityDetailsResponse = await entityDetails;
        if (entityDetailsResponse) {
          const jsonPatch = compare(entityDetailsResponse, {
            ...entityDetailsResponse,
            domain: selectedDomain,
          });

          const api = getAPIfromSource(entityType as AssetsUnion);
          const res = await api(entityId, jsonPatch);

          // update the domain details here
          setActiveDomain(res.domain);
          !isUndefined(afterDomainUpdateAction) && afterDomainUpdateAction(res);
        }
      } catch (err) {
        // Handle errors as needed
        showErrorToast(err as AxiosError);
      }
    },
    [entityType, entityFqn, afterDomainUpdateAction]
  );

  useEffect(() => {
    setActiveDomain(domain);
  }, [domain]);

  const label = useMemo(() => {
    return (
      <Space>
        <Typography.Text className="self-center text-xs whitespace-nowrap">
          <DomainIcon
            className="d-flex"
            color={DE_ACTIVE_COLOR}
            height={16}
            name="folder"
            width={16}
          />
        </Typography.Text>
        {activeDomain || domainDisplayName ? (
          <Link
            className="text-primary font-medium text-xs no-underline"
            data-testid="domain-link"
            to={getDomainPath(activeDomain?.fullyQualifiedName)}>
            {isUndefined(domainDisplayName)
              ? getEntityName(activeDomain)
              : domainDisplayName}
          </Link>
        ) : (
          <Typography.Text
            className="font-medium text-xs"
            data-testid="no-domain-text">
            {t('label.no-entity', { entity: t('label.domain') })}
          </Typography.Text>
        )}

        {hasPermission && (
          <DomainSelectableList
            hasPermission={Boolean(hasPermission)}
            selectedDomain={activeDomain}
            onUpdate={handleDomainSave}
          />
        )}
      </Space>
    );
  }, [activeDomain, hasPermission]);

  return label;
};

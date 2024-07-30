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
import { Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { get, isEmpty, isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { TabSpecificField } from '../../../enums/entity.enum';
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

export const DomainLabel = ({
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
}: DomainLabelProps) => {
  const { t } = useTranslation();
  const [activeDomain, setActiveDomain] = useState<EntityReference[]>([]);

  const handleDomainSave = useCallback(
    async (selectedDomain: EntityReference | EntityReference[]) => {
      const fieldData = getDomainFieldFromEntityType(entityType);

      const entityDetails = getEntityAPIfromSource(entityType as AssetsUnion)(
        entityFqn,
        { fields: TabSpecificField.DOMAIN }
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
    [entityType, entityId, entityFqn, afterDomainUpdateAction]
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
      return activeDomain.map((domain, index) => (
        <React.Fragment key={domain.id}>
          {renderDomainLink(
            domain,
            domainDisplayName,
            showDomainHeading,
            textClassName
          )}
          {index < activeDomain.length - 1 && ', '}
        </React.Fragment>
      ));
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
          hasPermission={Boolean(hasPermission)}
          multiple={multiple}
          selectedDomain={activeDomain}
          onUpdate={handleDomainSave}
        />
      )
    );
  }, [hasPermission, activeDomain, handleDomainSave]);

  const label = useMemo(() => {
    if (showDomainHeading) {
      return (
        <>
          <div className="d-flex items-center m-b-xs">
            <Typography.Text className="right-panel-label m-r-xss">
              {t('label.domain')}
            </Typography.Text>
            {selectableList}
          </div>

          <div className="d-flex items-center gap-1">
            <DomainIcon
              className="d-flex"
              color={DE_ACTIVE_COLOR}
              height={16}
              name="folder"
              width={16}
            />
            {domainLink}
          </div>
        </>
      );
    }

    return (
      <div
        className="d-flex items-center gap-1"
        data-testid="header-domain-container">
        <Typography.Text className="self-center text-xs whitespace-nowrap">
          <DomainIcon
            className="d-flex"
            color={DE_ACTIVE_COLOR}
            height={16}
            name="folder"
            width={16}
          />
        </Typography.Text>
        {domainLink}

        {selectableList}
      </div>
    );
  }, [activeDomain, hasPermission, selectableList]);

  return label;
};

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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import { ReactComponent as InheritIcon } from '../../../assets/svg/ic-inherit.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/type';
import {
    getAPIfromSource,
    getEntityAPIfromSource
} from '../../../utils/Assets/AssetsUtils';
import { renderDomainLink } from '../../../utils/DomainUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AssetsUnion } from '../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { DataAssetWithDomains } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { Dropdown, Tooltip } from '../AntdCompat';
import DomainSelectableList from '../DomainSelectableList/DomainSelectableList.component';
import './domain-label.less';
import { DomainLabelProps } from './DomainLabel.interface';
;
;

export const DomainLabel = ({
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
    } else {
      // note: this is to handle the case where the domain is not set
      setActiveDomain([]);
    }
  }, [domains]);

  const domainLink = useMemo(() => {
    if (
      activeDomain &&
      Array.isArray(activeDomain) &&
      activeDomain.length > 0
    ) {
      const domains = activeDomain.map((domain) => {
        const inheritedIcon = domain?.inherited ? (
          <Tooltip
            title={t('label.inherited-entity', {
              entity: t('label.domain-plural'),
            })}>
            <InheritIcon className="inherit-icon cursor-pointer" width={14} />
          </Tooltip>
        ) : null;

        return (
          <div
            className={classNames(
              'd-flex items-center gap-1 domain-link-container',
              {
                'gap-1': !headerLayout || (headerLayout && multiple),
              }
            )}
            key={domain.id}>
            {/* condition to show icon for new layout perticulary for multiple domains */}
            {(!headerLayout || (headerLayout && multiple)) && (
              <Typography.Text className="self-center text-xs whitespace-nowrap">
                <DomainIcon
                  className="d-flex"
                  color={DE_ACTIVE_COLOR}
                  height={16}
                  name="folder"
                  width={16}
                />
              </Typography.Text>
            )}
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

      // Show limited domains with "+N more" button when multiple and headerLayout are true
      if (multiple && headerLayout && domains.length > 1) {
        const visibleDomains = domains.slice(0, 1);
        const remainingCount = domains.length - 1;
        const remainingDomains = domains.slice(1);

        return (
          <div className="d-flex items-center gap-2 flex-wrap">
            {visibleDomains}
            <Dropdown
              menu={{
                items: remainingDomains.map((domain, index) => ({
                  key: index,
                  label: domain,
                })),
                className: 'domain-tooltip-list',
              }}>
              <Typography.Text className="domain-count-button flex-center text-sm font-medium">
                <span>+{remainingCount}</span>
              </Typography.Text>
            </Dropdown>
          </div>
        );
      }

      return domains;
    }

    return (
      <Typography.Text
        className={classNames(
          'domain-link-text',
          { 'font-medium text-sm': !showDomainHeading },
          textClassName
        )}
        data-testid="no-domain-text">
        {t('label.no-entity', { entity: t('label.domain-plural') })}
      </Typography.Text>
    );
  }, [
    activeDomain,
    domainDisplayName,
    showDomainHeading,
    textClassName,
    multiple,
    headerLayout,
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
              <Typography.Text className="right-panel-label m-r-xss">
                {t('label.domain-plural')}
              </Typography.Text>
            ) : (
              <Typography.Text className="domain-link right-panel-label m-r-xss">
                {activeDomain.length > 0
                  ? t('label.domain-plural')
                  : t('label.no-entity', { entity: t('label.domain-plural') })}
              </Typography.Text>
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
      <div className="d-flex flex-col domain-label-container gap-2 justify-start">
        {headerLayout && (
          <div
            className="d-flex text-sm gap-1 font-medium items-center "
            data-testid="header-domain-container">
            <Typography.Text className="domain-link right-panel-label m-r-xss">
              {t('label.domain-plural')}
            </Typography.Text>
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

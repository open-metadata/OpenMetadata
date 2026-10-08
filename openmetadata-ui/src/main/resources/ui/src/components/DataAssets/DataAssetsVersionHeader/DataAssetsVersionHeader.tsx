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

import Icon from '@ant-design/icons/lib/components/Icon';
import {
  Box,
  Divider,
  Grid,
  Owner,
  Typography,
} from '@openmetadata/ui-core-components';
import { Button, Tooltip } from 'antd';
import { get } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as VersionIcon } from '../../../assets/svg/ic-version.svg';
import { DomainLabel } from '../../../components/common/DomainLabel/DomainLabel.component';
import EntityHeaderTitle from '../../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component';
import { EntityType } from '../../../enums/entity.enum';
import { SearchSourceAlias } from '../../../interface/search.interface';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import { getDataAssetsVersionHeaderInfo } from '../../../utils/DataAssetsVersionHeaderUtils';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import './data-asset-version-header.less';
import { DataAssetsVersionHeaderProps } from './DataAssetsVersionHeader.interface';

function DataAssetsVersionHeader({
  breadcrumbLinks,
  version,
  deleted,
  displayName,
  currentVersionData,
  ownerDisplayName,
  tierDisplayName,
  ownerRef,
  onVersionClick,
  entityType,
  serviceName,
  domainDisplayName,
  domains,
}: DataAssetsVersionHeaderProps) {
  const { t } = useTranslation();

  const extraInfo = useMemo(
    () => getDataAssetsVersionHeaderInfo(entityType, currentVersionData),
    [entityType, currentVersionData]
  );

  const icon = useMemo(() => {
    const serviceType = get(currentVersionData, 'serviceType', '');

    return serviceType ? (
      <img
        alt="service-icon"
        className="h-9"
        src={serviceUtilClassBase.getServiceTypeLogo(
          currentVersionData as SearchSourceAlias
        )}
      />
    ) : null;
  }, [currentVersionData]);

  return (
    <Box
      className="layout-row version-header-container"
      justify="between"
      style={{ ...getLayoutGutter(8, 12) }}
      wrap="wrap">
      <Box
        className="layout-column tw:block self-center"
        style={{ maxWidth: '87.5%', flex: `0 0 ${'87.5%'}` }}>
        <Grid
          className="layout-row layout-grid"
          style={{ ...getLayoutGutter(16, 12) }}>
          <Grid.Item className="layout-column" span={24}>
            <TitleBreadcrumb titleLinks={breadcrumbLinks} />
          </Grid.Item>
          <Grid.Item className="layout-column" span={24}>
            <EntityHeaderTitle
              deleted={deleted}
              displayName={displayName}
              icon={icon}
              name={currentVersionData?.name}
              serviceName={serviceName ?? ''}
            />
          </Grid.Item>
          <Grid.Item className="layout-column" span={24}>
            <div className="d-flex version-domain-container no-wrap">
              {entityType !== EntityType.METADATA_SERVICE && (
                <>
                  <DomainLabel
                    multiple
                    domainDisplayName={domainDisplayName}
                    domains={domains}
                    entityFqn={currentVersionData.fullyQualifiedName ?? ''}
                    entityId={currentVersionData.id ?? ''}
                    entityType={entityType}
                    hasPermission={false}
                  />
                  <Divider
                    className="self-center m-x-sm tw:h-[0.9em]"
                    orientation="vertical"
                  />
                </>
              )}
              <Owner
                isCompactView={false}
                ownerDisplayName={ownerDisplayName}
                owners={currentVersionData?.owners ?? ownerRef}
                showLabel={false}
              />
              <Divider
                className="self-center m-x-sm tw:h-[0.9em]"
                orientation="vertical"
              />

              <Box
                inline
                align="center"
                className="layout-space layout-space-horizontal"
                gap={2}
                itemClassName="layout-space-item">
                {tierDisplayName ? (
                  <span className="font-medium text-xs" data-testid="Tier">
                    {tierDisplayName}
                  </span>
                ) : (
                  <span className="font-medium text-xs" data-testid="Tier">
                    {t('label.no-entity', {
                      entity: t('label.tier'),
                    })}
                  </span>
                )}
              </Box>
              {extraInfo}
            </div>
          </Grid.Item>
        </Grid>
      </Box>
      <Box
        className="layout-column tw:block"
        style={{ maxWidth: '12.5%', flex: `0 0 ${'12.5%'}` }}>
        <Box className="layout-row" justify="end" wrap="wrap">
          <Box className="layout-column tw:block">
            <Tooltip title={t('label.exit-version-history')}>
              <Button
                className="w-16 p-0"
                data-testid="version-button"
                icon={<Icon component={VersionIcon} />}
                onClick={onVersionClick}>
                <Typography>{version}</Typography>
              </Button>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default DataAssetsVersionHeader;

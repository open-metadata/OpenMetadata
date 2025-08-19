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
import { Button, Col, Divider, Row, Space, Typography } from 'antd';
import { Tooltip } from '../../common/AntdCompat';;
import { get } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as VersionIcon } from '../../../assets/svg/ic-version.svg';
import { DomainLabel } from '../../../components/common/DomainLabel/DomainLabel.component';
import { OwnerLabel } from '../../../components/common/OwnerLabel/OwnerLabel.component';
import EntityHeaderTitle from '../../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component';
import { EntityType } from '../../../enums/entity.enum';
import { SearchSourceAlias } from '../../../interface/search.interface';
import { getDataAssetsVersionHeaderInfo } from '../../../utils/DataAssetsVersionHeaderUtils';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import { EntitiesWithDomainField } from '../DataAssetsHeader/DataAssetsHeader.interface';
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
    <Row
      className="version-header-container"
      gutter={[8, 12]}
      justify="space-between">
      <Col className="self-center" span={21}>
        <Row gutter={[16, 12]}>
          <Col span={24}>
            <TitleBreadcrumb titleLinks={breadcrumbLinks} />
          </Col>
          <Col span={24}>
            <EntityHeaderTitle
              deleted={deleted}
              displayName={displayName}
              icon={icon}
              name={currentVersionData?.name}
              serviceName={serviceName ?? ''}
            />
          </Col>
          <Col span={24}>
            <div className="d-flex version-domain-container no-wrap">
              {entityType !== EntityType.METADATA_SERVICE && (
                <>
                  <DomainLabel
                    multiple
                    domainDisplayName={domainDisplayName}
                    domains={
                      (currentVersionData as EntitiesWithDomainField).domains
                    }
                    entityFqn={currentVersionData.fullyQualifiedName ?? ''}
                    entityId={currentVersionData.id ?? ''}
                    entityType={entityType}
                    hasPermission={false}
                  />
                  <Divider className="self-center m-x-sm" type="vertical" />
                </>
              )}
              <OwnerLabel
                ownerDisplayName={ownerDisplayName}
                owners={currentVersionData?.owners ?? ownerRef}
              />
              <Divider className="self-center m-x-sm" type="vertical" />

              <Space>
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
              </Space>
              {extraInfo}
            </div>
          </Col>
        </Row>
      </Col>
      <Col span={3}>
        <Row justify="end">
          <Col>
            <Tooltip title={t('label.exit-version-history')}>
              <Button
                className="w-16 p-0"
                data-testid="version-button"
                icon={<Icon component={VersionIcon} />}
                onClick={onVersionClick}>
                <Typography.Text>{version}</Typography.Text>
              </Button>
            </Tooltip>
          </Col>
        </Row>
      </Col>
    </Row>
  );
}

export default DataAssetsVersionHeader;

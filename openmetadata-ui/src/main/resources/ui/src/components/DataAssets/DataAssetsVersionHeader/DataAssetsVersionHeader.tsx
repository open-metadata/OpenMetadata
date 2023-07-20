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
import { ReactComponent as VersionIcon } from 'assets/svg/ic-version.svg';
import { OwnerLabel } from 'components/common/OwnerLabel/OwnerLabel.component';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import EntityHeaderTitle from 'components/Entity/EntityHeaderTitle/EntityHeaderTitle.component';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { serviceTypeLogo } from 'utils/ServiceUtils';
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
}: DataAssetsVersionHeaderProps) {
  const { t } = useTranslation();

  return (
    <Row className="p-x-lg" gutter={[8, 12]} justify="space-between">
      <Col className="self-center">
        <Row gutter={[16, 12]}>
          <Col span={24}>
            <TitleBreadcrumb titleLinks={breadcrumbLinks} />
          </Col>
          <Col span={24}>
            <EntityHeaderTitle
              deleted={deleted}
              displayName={displayName}
              icon={
                currentVersionData.serviceType && (
                  <img
                    className="h-9"
                    src={serviceTypeLogo(currentVersionData.serviceType)}
                  />
                )
              }
              name={currentVersionData?.name}
              serviceName={currentVersionData.service?.name ?? ''}
            />
          </Col>
          <Col span={24}>
            <div className="d-flex no-wrap">
              <OwnerLabel
                owner={currentVersionData?.owner ?? ownerRef}
                ownerDisplayName={ownerDisplayName}
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
            </div>
          </Col>
        </Row>
      </Col>
      <Col>
        <Button
          className="w-16 p-0"
          data-testid="version-button"
          icon={<Icon component={VersionIcon} />}
          onClick={onVersionClick}>
          <Typography.Text>{version}</Typography.Text>
        </Button>
      </Col>
    </Row>
  );
}

export default DataAssetsVersionHeader;

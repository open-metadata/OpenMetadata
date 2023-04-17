/*
 *  Copyright 2022 Collate.
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

import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Card, Col, Divider, Row, Space, Tag, Typography } from 'antd';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageHeader from 'components/header/PageHeader.component';
import { HeaderProps } from 'components/header/PageHeader.interface';
import {
  Effect,
  EventSubscription,
  SubscriptionType,
} from 'generated/events/eventSubscription';
import { isArray } from 'lodash';
import React, { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconEdit } from '../../../assets/svg/ic-edit.svg';
import {
  EDIT_LINK_PATH,
  getAlertActionTypeDisplayName,
  getAlertsActionTypeIcon,
  getDisplayNameForEntities,
  getFunctionDisplayName,
} from '../../../utils/Alerts/AlertsUtil';
import { getHostNameFromURL } from '../../../utils/CommonUtils';

interface AlertDetailsComponentProps {
  alerts: EventSubscription;
  onDelete: () => void;
  pageHeaderData?: HeaderProps['data'];
  breadcrumb?: TitleBreadcrumbProps['titleLinks'];
  allowDelete?: boolean;
  allowEdit?: boolean;
}

export const AlertDetailsComponent = ({
  alerts,
  onDelete,
  pageHeaderData,
  allowDelete = true,
  breadcrumb,
  allowEdit = true,
}: AlertDetailsComponentProps) => {
  const { t } = useTranslation();

  return (
    <Row align="middle" gutter={[16, 16]}>
      <Col span={24}>
        <div className="d-flex items-center justify-between">
          {breadcrumb ? <TitleBreadcrumb titleLinks={breadcrumb} /> : null}

          {pageHeaderData ? <PageHeader data={pageHeaderData} /> : null}
          <Space size={16}>
            {allowEdit && (
              <Link to={`${EDIT_LINK_PATH}/${alerts?.id}`}>
                <Button icon={<Icon component={IconEdit} size={12} />}>
                  {t('label.edit')}
                </Button>
              </Link>
            )}
            {allowDelete && (
              <Button
                icon={<Icon component={IconDelete} size={12} />}
                onClick={onDelete}>
                {t('label.delete')}
              </Button>
            )}
          </Space>
        </div>
      </Col>
      <Col span={24}>
        <Card>
          <Space direction="vertical" size={8}>
            <Typography.Title className="m-0" level={5}>
              {t('label.trigger')}
            </Typography.Title>
            <Typography.Text data-testid="display-name-entities">
              {alerts?.filteringRules.resources
                ?.map(getDisplayNameForEntities)
                ?.join(', ')}
            </Typography.Text>
          </Space>
          <Divider />
          <Typography.Title level={5}>
            {t('label.filter-plural')}
          </Typography.Title>
          <Typography.Paragraph>
            {alerts?.filteringRules?.rules?.map((filter) => {
              const conditions = isArray(filter.condition)
                ? filter.condition.join(', ')
                : filter.condition;
              const effect = filter.effect === Effect.Include ? '===' : '!==';
              const conditionName = getFunctionDisplayName(
                filter.fullyQualifiedName ?? ''
              );

              return (
                <Fragment key={filter.name}>
                  <Typography.Text code>
                    {`${conditionName} ${effect} ${conditions}`}
                  </Typography.Text>
                  <br />
                </Fragment>
              );
            })}
          </Typography.Paragraph>
          <Divider />
          <Typography.Title level={5}>
            {t('label.destination')}
          </Typography.Title>
          <Row gutter={[16, 16]}>
            <Col key={alerts.name} span={8}>
              {alerts.subscriptionType === SubscriptionType.ActivityFeed ? (
                <Space size={16}>
                  {getAlertsActionTypeIcon(alerts.subscriptionType)}

                  {getAlertActionTypeDisplayName(
                    alerts.subscriptionType ?? SubscriptionType.GenericWebhook
                  )}
                </Space>
              ) : (
                <Card
                  className="h-full"
                  title={
                    <Space size={16}>
                      {getAlertsActionTypeIcon(alerts.subscriptionType)}

                      {getAlertActionTypeDisplayName(
                        alerts.subscriptionType ??
                          SubscriptionType.GenericWebhook
                      )}
                    </Space>
                  }>
                  <Space direction="vertical" size={8}>
                    {alerts.subscriptionType === SubscriptionType.Email && (
                      <>
                        <Typography.Text>
                          {t('label.send-to')}:{' '}
                          <div>
                            {alerts.subscriptionConfig?.receivers?.map(
                              (rec) => (
                                <Tag key={rec}>{rec}</Tag>
                              )
                            )}
                          </div>
                        </Typography.Text>
                        <Typography.Text>
                          <Space size={16}>
                            <span>
                              {alerts.subscriptionConfig.sendToAdmins ? (
                                <CheckCircleOutlined />
                              ) : (
                                <CloseCircleOutlined />
                              )}{' '}
                              {t('label.admin-plural')}
                            </span>
                            <span>
                              {alerts.subscriptionConfig.sendToOwners ? (
                                <CheckCircleOutlined />
                              ) : (
                                <CloseCircleOutlined />
                              )}{' '}
                              {t('label.owner-plural')}
                            </span>
                            <span>
                              {alerts.subscriptionConfig.sendToFollowers ? (
                                <CheckCircleOutlined />
                              ) : (
                                <CloseCircleOutlined />
                              )}{' '}
                              {t('label.follower-plural')}
                            </span>
                          </Space>
                        </Typography.Text>
                      </>
                    )}
                    {alerts.subscriptionType !== SubscriptionType.Email && (
                      <>
                        <Typography.Text>
                          <Typography.Text type="secondary">
                            {t('label.webhook')}:{' '}
                          </Typography.Text>
                          {getHostNameFromURL(
                            alerts.subscriptionConfig?.endpoint ?? '-'
                          )}
                        </Typography.Text>
                        <Typography.Text>
                          <Typography.Text type="secondary">
                            {t('label.batch-size')}:{' '}
                          </Typography.Text>
                          {alerts.batchSize}
                        </Typography.Text>
                        <Typography.Text>
                          <Typography.Text type="secondary">
                            {t('message.field-timeout-description')}:{' '}
                          </Typography.Text>
                          {alerts.timeout}
                        </Typography.Text>
                        <Typography.Text>
                          <Typography.Text type="secondary">
                            {t('label.secret-key')}:{' '}
                          </Typography.Text>

                          {alerts.subscriptionConfig?.secretKey ? '****' : '-'}
                        </Typography.Text>
                      </>
                    )}
                  </Space>
                </Card>
              )}
            </Col>
          </Row>
        </Card>
      </Col>
    </Row>
  );
};

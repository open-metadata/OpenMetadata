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
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Card, Col, Divider, Row, Space, Tag, Typography } from 'antd';
import { ReactComponent as IconEdit } from 'assets/svg/edit-new.svg';
import PageHeader from 'components/header/PageHeader.component';
import {
  EventSubscription,
  ScheduleInfo,
  SubscriptionType,
} from 'generated/events/eventSubscription';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAlertActionTypeDisplayName,
  getAlertsActionTypeIcon,
} from 'utils/Alerts/AlertsUtil';

const AlertDataInsightReportPage = () => {
  const { t } = useTranslation();
  const [dataInsightAlert] = useState<EventSubscription>();

  return (
    <Row align="middle" gutter={[16, 16]}>
      <Col span={24}>
        <Space className="w-full justify-between">
          <PageHeader
            data={{
              header: 'DataInsights Report Alert [WIP]',
              subHeader:
                'Alert Received on the DataInsights are controlled with this.',
            }}
          />

          <Button
            data-testid="edit-button"
            icon={<Icon component={IconEdit} size={12} />}>
            {t('label.edit')}
          </Button>
        </Space>
      </Col>
      <Col span={24}>
        <Card>
          <Typography.Title className="m-0" data-testid="trigger" level={5}>
            {t('label.trigger')}
          </Typography.Title>
          <Typography.Text>
            {dataInsightAlert?.trigger?.triggerType}
          </Typography.Text>
          <Divider />

          <Typography.Title data-testid="schedule-info" level={5}>
            {t('label.schedule-info')}
          </Typography.Title>
          <Typography.Text>
            {dataInsightAlert?.trigger?.scheduleInfo}
          </Typography.Text>
          <Typography.Text>
            {dataInsightAlert?.trigger?.scheduleInfo === ScheduleInfo.Custom
              ? dataInsightAlert?.trigger?.cronExpression
              : null}
          </Typography.Text>
          <Divider />

          <Typography.Title data-testid="destination" level={5}>
            {t('label.destination')}
          </Typography.Title>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Card
                className="h-full"
                data-testid="destination-card"
                title={
                  <Space size={16}>
                    {getAlertsActionTypeIcon(SubscriptionType.Email)}

                    {getAlertActionTypeDisplayName(SubscriptionType.Email)}
                  </Space>
                }>
                <Space direction="vertical" size={8}>
                  <Typography.Text>
                    {t('label.send-to')}:{' '}
                    <div>
                      {dataInsightAlert?.subscriptionConfig?.receivers?.map(
                        (rec) => (
                          <Tag key={rec}>{rec}</Tag>
                        )
                      )}
                    </div>
                  </Typography.Text>
                  <Space size={16}>
                    <span>
                      {dataInsightAlert?.subscriptionConfig?.sendToAdmins ? (
                        <CheckCircleOutlined />
                      ) : (
                        <CloseCircleOutlined />
                      )}{' '}
                      {t('label.admin-plural')}
                    </span>
                    <span>
                      {dataInsightAlert?.subscriptionConfig?.sendToOwners ? (
                        <CheckCircleOutlined />
                      ) : (
                        <CloseCircleOutlined />
                      )}{' '}
                      {t('label.owner-plural')}
                    </span>
                    <span>
                      {dataInsightAlert?.subscriptionConfig?.sendToFollowers ? (
                        <CheckCircleOutlined />
                      ) : (
                        <CloseCircleOutlined />
                      )}{' '}
                      {t('label.follower-plural')}
                    </span>
                  </Space>
                </Space>
              </Card>
            </Col>
          </Row>
        </Card>
      </Col>
    </Row>
  );
};

export default AlertDataInsightReportPage;

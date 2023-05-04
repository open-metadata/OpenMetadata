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
import {
  Button,
  Card,
  Col,
  Divider,
  Popover,
  Row,
  Space,
  Tag,
  Typography,
} from 'antd';
import { ReactComponent as IconEdit } from 'assets/svg/edit-new.svg';
import { AxiosError } from 'axios';
import PageHeader from 'components/header/PageHeader.component';
import Loader from 'components/Loader/Loader';
import formateCron from 'cronstrue';
import {
  EventSubscription,
  ScheduleInfo,
  SubscriptionType,
} from 'generated/events/eventSubscription';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAlertsFromName } from 'rest/alertsAPI';
import {
  getAlertActionTypeDisplayName,
  getAlertsActionTypeIcon,
} from 'utils/Alerts/AlertsUtil';
import { getEntityName } from 'utils/EntityUtils';
import { showErrorToast } from 'utils/ToastUtils';

const AlertDataInsightReportPage = () => {
  const { t } = useTranslation();
  const [isLoading, setLoading] = useState<boolean>(false);
  const [dataInsightAlert, setDataInsightAlert] = useState<EventSubscription>();

  const fetchDataInsightsAlert = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getAlertsFromName('DataInsightReport');
      setDataInsightAlert(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDataInsightsAlert();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Row align="middle" gutter={[16, 16]}>
      <Col span={24}>
        <Space className="w-full justify-between">
          <PageHeader
            data={{
              header: getEntityName(dataInsightAlert),
              subHeader: dataInsightAlert?.description || '',
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
          {/* Trigger section */}
          <>
            <Typography.Title data-testid="trigger" level={5}>
              {t('label.trigger')}
            </Typography.Title>
            <Typography.Text data-testid="trigger-type">
              {dataInsightAlert?.trigger?.triggerType}
            </Typography.Text>
          </>
          <Divider />

          {/* Schedule Info Section */}
          <>
            <Typography.Title data-testid="schedule-info" level={5}>
              {t('label.schedule-info')}
            </Typography.Title>
            <Space>
              <Typography.Text data-testid="schedule-info-type">
                {dataInsightAlert?.trigger?.scheduleInfo}
              </Typography.Text>

              {dataInsightAlert?.trigger?.scheduleInfo ===
                ScheduleInfo.Custom &&
              dataInsightAlert?.trigger?.cronExpression ? (
                <Popover
                  content={
                    <div>
                      {formateCron.toString(
                        dataInsightAlert.trigger.cronExpression,
                        {
                          use24HourTimeFormat: true,
                          verbose: true,
                        }
                      )}
                    </div>
                  }
                  placement="bottom"
                  trigger="hover">
                  <Tag>{dataInsightAlert.trigger.cronExpression}</Tag>
                </Popover>
              ) : null}
            </Space>
          </>
          <Divider />

          {/* Destination section */}
          <>
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
                          (receiver) => (
                            <Tag key={receiver}>{receiver}</Tag>
                          )
                        )}
                      </div>
                    </Typography.Text>
                    <Space size={16}>
                      <span>
                        {dataInsightAlert?.subscriptionConfig?.sendToAdmins ? (
                          <CheckCircleOutlined data-testid="sendToAdmins" />
                        ) : (
                          <CloseCircleOutlined />
                        )}{' '}
                        {t('label.admin-plural')}
                      </span>
                      <span>
                        {dataInsightAlert?.subscriptionConfig?.sendToTeams ? (
                          <CheckCircleOutlined data-testid="sendToTeams" />
                        ) : (
                          <CloseCircleOutlined />
                        )}{' '}
                        {t('label.team-plural')}
                      </span>
                    </Space>
                  </Space>
                </Card>
              </Col>
            </Row>
          </>
        </Card>
      </Col>
    </Row>
  );
};

export default AlertDataInsightReportPage;

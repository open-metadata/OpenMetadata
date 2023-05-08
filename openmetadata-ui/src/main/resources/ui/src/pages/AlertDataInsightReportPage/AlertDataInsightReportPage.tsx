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
  Typography,
} from 'antd';
import { ReactComponent as IconEdit } from 'assets/svg/edit-new.svg';
import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import PageHeader from 'components/header/PageHeader.component';
import Loader from 'components/Loader/Loader';
import { ALERTS_DOCS } from 'constants/docs.constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from 'constants/GlobalSettings.constants';
import formateCron from 'cronstrue';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import {
  EventSubscription,
  ScheduleInfo,
} from 'generated/events/eventSubscription';
import { isUndefined } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { getAlertsFromName } from 'rest/alertsAPI';
import { EDIT_DATA_INSIGHT_REPORT_PATH } from 'utils/Alerts/AlertsUtil';
import { getSettingPath } from 'utils/RouterUtils';
import { showErrorToast } from 'utils/ToastUtils';

const AlertDataInsightReportPage = () => {
  const { t } = useTranslation();
  const history = useHistory();
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

  if (isUndefined(dataInsightAlert)) {
    return (
      <ErrorPlaceHolder
        permission
        doc={ALERTS_DOCS}
        heading={t('label.data-insight-report')}
        type={ERROR_PLACEHOLDER_TYPE.CREATE}
        onClick={() =>
          history.push(
            getSettingPath(
              GlobalSettingsMenuCategory.NOTIFICATIONS,
              GlobalSettingOptions.ADD_DATA_INSIGHT_REPORT_ALERT
            )
          )
        }
      />
    );
  }

  return (
    <Row align="middle" gutter={[16, 16]}>
      <Col span={24}>
        <Space className="w-full justify-between">
          <PageHeader
            data={{
              header: t('label.data-insight-report'),
              subHeader: dataInsightAlert?.description ?? '',
            }}
          />

          <Link
            data-testid="edit-button"
            to={`${EDIT_DATA_INSIGHT_REPORT_PATH}/${dataInsightAlert?.id}`}>
            <Button icon={<Icon component={IconEdit} size={12} />}>
              {t('label.edit')}
            </Button>
          </Link>
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
                  <Typography.Text code>
                    {dataInsightAlert.trigger.cronExpression}
                  </Typography.Text>
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
            <Space size={8}>
              <Typography.Text>{t('label.send-to')}</Typography.Text>
              <Typography.Text>
                {dataInsightAlert?.subscriptionConfig?.sendToAdmins ? (
                  <CheckCircleOutlined data-testid="sendToAdmins" />
                ) : (
                  <CloseCircleOutlined />
                )}{' '}
                {t('label.admin-plural')}
              </Typography.Text>
              <Typography.Text>
                {dataInsightAlert?.subscriptionConfig?.sendToTeams ? (
                  <CheckCircleOutlined data-testid="sendToTeams" />
                ) : (
                  <CloseCircleOutlined />
                )}{' '}
                {t('label.team-plural')}
              </Typography.Text>
            </Space>
          </>
        </Card>
      </Col>
    </Row>
  );
};

export default AlertDataInsightReportPage;

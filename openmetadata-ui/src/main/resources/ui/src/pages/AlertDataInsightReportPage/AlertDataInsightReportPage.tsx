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
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Popover,
  Row,
  Space,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import formateCron from 'cronstrue';
import { isUndefined } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { ReactComponent as IconEdit } from '../../assets/svg/edit-new.svg';
import { ReactComponent as IconSend } from '../../assets/svg/paper-plane.svg';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import PageHeader from '../../components/header/PageHeader.component';
import Loader from '../../components/Loader/Loader';
import { ALERTS_DOCS } from '../../constants/docs.constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import {
  EventSubscription,
  ScheduleInfo,
} from '../../generated/events/eventSubscription';
import { useAuth } from '../../hooks/authHooks';
import { getAlertsFromName, triggerEventById } from '../../rest/alertsAPI';
import { EDIT_DATA_INSIGHT_REPORT_PATH } from '../../utils/Alerts/AlertsUtil';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const AlertDataInsightReportPage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { isAdminUser } = useAuth();
  const [isLoading, setLoading] = useState<boolean>(false);
  const [dataInsightAlert, setDataInsightAlert] = useState<EventSubscription>();
  const [isSendingReport, setIsSendingReport] = useState<boolean>(false);

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

  const handleSendDataInsightReport = async () => {
    if (isUndefined(dataInsightAlert)) {
      return;
    }

    try {
      setIsSendingReport(true);
      await triggerEventById(dataInsightAlert.id);
      showSuccessToast(t('message.data-insight-report-send-success-message'));
    } catch (error) {
      showErrorToast(t('message.data-insight-report-send-failed-message'));
    } finally {
      setIsSendingReport(false);
    }
  };

  useEffect(() => {
    fetchDataInsightsAlert();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  if (!isAdminUser) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
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

  const isEnabled = Boolean(dataInsightAlert?.enabled);

  return (
    <Row align="middle" gutter={[16, 16]}>
      <Col span={24}>
        <Space className="w-full justify-between">
          <PageHeader
            data={{
              header: (
                <Space align="center" size={4}>
                  {t('label.data-insight-report')}{' '}
                  {!isEnabled ? (
                    <Badge
                      className="badge-grey"
                      count={t('label.disabled')}
                      data-testid="disabled"
                    />
                  ) : null}
                </Space>
              ),
              subHeader: dataInsightAlert?.description ?? '',
            }}
          />
          <Space size={16}>
            <Link
              data-testid="edit-button"
              to={`${EDIT_DATA_INSIGHT_REPORT_PATH}/${dataInsightAlert?.id}`}>
              <Button icon={<Icon component={IconEdit} size={12} />}>
                {t('label.edit')}
              </Button>
            </Link>
            <Button
              data-testid="send-now-button"
              icon={<Icon component={IconSend} size={12} />}
              loading={isSendingReport}
              onClick={handleSendDataInsightReport}>
              {t('label.send')}
            </Button>
          </Space>
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

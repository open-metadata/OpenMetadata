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
import {
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Typography,
} from 'antd';
import { useForm } from 'antd/es/form/Form';
import CronEditor from 'components/common/CronEditor/CronEditor';
import {
  getDayCron,
  getPeriodOptions,
} from 'components/common/CronEditor/CronEditor.constant';
import RichTextEditor from 'components/common/rich-text-editor/RichTextEditor';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from 'constants/GlobalSettings.constants';
import {
  AlertType,
  EventSubscription,
  ScheduleInfo,
  Trigger,
  TriggerType,
} from 'generated/events/eventSubscription';
import { isEmpty, map, noop } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { createAlert, getAlertsFromId, updateAlert } from 'rest/alertsAPI';
import { StyledCard } from 'utils/Alerts/AlertsUtil';
import { getSettingPath } from 'utils/RouterUtils';
import { showErrorToast, showSuccessToast } from 'utils/ToastUtils';
import './add-data-insight-report-alert.less';

const AddDataInsightReportAlert = () => {
  const { t } = useTranslation();
  const [form] = useForm<EventSubscription>();
  const history = useHistory();
  const { fqn: alertId } = useParams<{ fqn: string }>();

  const [loading, setLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const isEditMode = useMemo(() => !isEmpty(alertId), [alertId]);
  const cronPeriodOptions = useMemo(() => {
    const options = getPeriodOptions();

    return map(options, (option) => {
      const label = option.label;

      return label !== 'None' ? label : '';
    }).filter(Boolean);
  }, []);

  const fetchDataInsightsAlert = async () => {
    try {
      setLoading(true);
      const response: EventSubscription = await getAlertsFromId(alertId);

      form.setFieldsValue({
        ...response,
        trigger: {
          ...(response.trigger as Trigger),
          cronExpression:
            response.trigger?.cronExpression ??
            getDayCron({
              min: 0,
              hour: 0,
            }),
        },
      });
    } catch {
      showErrorToast(
        t('server.entity-fetch-error', { entity: t('label.alert') })
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: EventSubscription) => {
    setIsSaving(true);

    const api = isEditMode ? updateAlert : createAlert;

    try {
      await api({
        ...data,
        alertType: AlertType.DataInsightReport,
      });
      showSuccessToast(
        t(`server.${isEditMode ? 'update' : 'create'}-entity-success`, {
          entity: t('label.alert-plural'),
        })
      );
      history.push(
        getSettingPath(
          GlobalSettingsMenuCategory.NOTIFICATIONS,
          GlobalSettingOptions.DATA_INSIGHT_REPORT_ALERT
        )
      );
    } catch (error) {
      showErrorToast(
        t(
          `server.${
            isEditMode ? 'entity-updating-error' : 'entity-creation-error'
          }`,
          {
            entity: t('label.alert-plural'),
          }
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  const scheduleInfo = Form.useWatch(['trigger', 'scheduleInfo'], form);

  useEffect(() => {
    if (alertId) {
      fetchDataInsightsAlert();
    }
  }, [alertId]);

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Typography.Title level={5}>
          {isEditMode
            ? t('label.edit-entity', {
                entity: t('label.data-insight-report-alert'),
              })
            : t('label.create-entity', {
                entity: t('label.data-insight-report-alert'),
              })}
        </Typography.Title>
        <Typography.Text>{t('message.alerts-description')}</Typography.Text>
      </Col>

      <Col span={24}>
        <Form<EventSubscription>
          className="data-insight-report-alert-form"
          form={form}
          onFinish={handleSave}>
          <Card loading={loading}>
            <Form.Item
              label={t('label.name')}
              labelCol={{ span: 24 }}
              name="name"
              rules={[{ required: true }]}>
              <Input disabled={isEditMode} />
            </Form.Item>

            <Form.Item
              label={t('label.description')}
              labelCol={{ span: 24 }}
              name="description"
              trigger="onTextChange"
              valuePropName="initialValue">
              <RichTextEditor
                data-testid="description"
                height="200px"
                initialValue=""
              />
            </Form.Item>

            <Form.Item>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Space className="w-full" direction="vertical" size={16}>
                    <StyledCard
                      heading={t('label.trigger')}
                      subHeading={t('message.alerts-trigger-description')}
                    />

                    <div>
                      <Form.Item
                        required
                        initialValue={[TriggerType.Scheduled]}
                        label={t('label.trigger-type')}
                        labelCol={{ span: 24 }}
                        name={['trigger', 'triggerType']}>
                        <Select
                          className="w-full"
                          data-testid="triggerType"
                          options={[
                            {
                              label: TriggerType.Scheduled,
                              value: TriggerType.Scheduled,
                            },
                          ]}
                        />
                      </Form.Item>

                      <Form.Item
                        required
                        label={t('label.schedule-info')}
                        labelCol={{ span: 24 }}
                        name={['trigger', 'scheduleInfo']}>
                        <Select
                          className="w-full"
                          data-testid="scheduleInfo"
                          options={map(ScheduleInfo, (scheduleInfo) => ({
                            label: scheduleInfo,
                            value: scheduleInfo,
                          }))}
                        />
                      </Form.Item>

                      {scheduleInfo === ScheduleInfo.Custom && (
                        <Form.Item
                          name={['trigger', 'cronExpression']}
                          trigger="onChange"
                          valuePropName="value">
                          <CronEditor
                            includePeriodOptions={cronPeriodOptions}
                            onChange={noop}
                          />
                        </Form.Item>
                      )}
                    </div>
                  </Space>
                </Col>
                <Col span={12}>
                  <Space className="w-full" direction="vertical" size={16}>
                    <StyledCard
                      heading={t('label.destination')}
                      subHeading={t('message.alerts-destination-description')}
                    />

                    <div>
                      {/* Hidden field as we don't want user to change it, but required in payload */}
                      <Form.Item
                        hidden
                        name="subscriptionType"
                        rules={[
                          {
                            required: true,
                            message: t('label.field-required', {
                              field: t('label.destination'),
                            }),
                          },
                        ]}>
                        <Input />
                      </Form.Item>

                      <Space align="baseline">
                        <label>{t('label.send-to')}:</label>
                        <Form.Item
                          name={['subscriptionConfig', 'sendToAdmins']}
                          valuePropName="checked">
                          <Checkbox>{t('label.admin-plural')}</Checkbox>
                        </Form.Item>
                        <Form.Item
                          name={['subscriptionConfig', 'sendToTeams']}
                          valuePropName="checked">
                          <Checkbox>{t('label.team-plural')}</Checkbox>
                        </Form.Item>
                      </Space>
                    </div>
                  </Space>
                </Col>
                <Col className="form-footer" span={24}>
                  <Button onClick={() => history.goBack()}>
                    {t('label.cancel')}
                  </Button>
                  <Button
                    data-testid="save"
                    htmlType="submit"
                    loading={isSaving}
                    type="primary">
                    {t('label.save')}
                  </Button>
                </Col>
              </Row>
            </Form.Item>
          </Card>
        </Form>
      </Col>
    </Row>
  );
};

export default AddDataInsightReportAlert;

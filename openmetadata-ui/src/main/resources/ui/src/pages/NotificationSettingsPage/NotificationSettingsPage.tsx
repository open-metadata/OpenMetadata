/*
 *  Copyright 2026 Collate.
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
import { Button, Col, Form, Row, Switch, Typography } from 'antd';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { NotificationSettings } from '../../generated/configuration/notificationSettings';
import { Settings, SettingType } from '../../generated/settings/settings';
import {
  getSettingsConfigFromConfigType,
  updateSettingsConfig,
} from '../../rest/settingConfigAPI';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const NotificationSettingsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm<NotificationSettings>();
  const [isLoading, setIsLoading] = useState(true);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        t('label.notification-plural')
      ),
    []
  );

  const fetchNotificationSettings = async () => {
    setIsLoading(true);
    try {
      const { data } = await getSettingsConfigFromConfigType(
        SettingType.NotificationSettings
      );

      const configValue = data?.config_value as
        | NotificationSettings
        | undefined;

      form.setFieldsValue({
        enableQueryChangeEvents: Boolean(configValue?.enableQueryChangeEvents),
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (values: NotificationSettings) => {
    setIsFormSubmitting(true);
    try {
      await updateSettingsConfig({
        config_type: SettingType.NotificationSettings,
        config_value: {
          enableQueryChangeEvents: Boolean(values.enableQueryChangeEvents),
        } as Settings['config_value'],
      });
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.notification-plural'),
        })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsFormSubmitting(false);
    }
  };

  useEffect(() => {
    fetchNotificationSettings();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle={t('label.notification-plural')}>
      <div className="m-b-mlg">
        <TitleBreadcrumb titleLinks={breadcrumbs} />
      </div>
      <Form<NotificationSettings>
        className="new-form-style"
        data-testid="notification-settings-form"
        form={form}
        id="notification-settings"
        layout="vertical"
        onFinish={handleSubmit}>
        <Row gutter={[0, 24]}>
          <Col span={24}>
            <PageHeader
              data={{
                header: t('label.notification-plural'),
                subHeader: t(
                  'message.page-sub-header-for-notification-setting'
                ),
              }}
              title={t('label.notification-plural')}
            />
          </Col>
          <Col span={24}>
            <Row align="middle" justify="space-between" wrap={false}>
              <Col flex="auto">
                <Typography.Text strong>
                  {t('label.query-change-event-plural')}
                </Typography.Text>
                <Typography.Paragraph className="text-grey-muted m-b-0">
                  {t('message.query-change-event-description')}
                </Typography.Paragraph>
              </Col>
              <Col className="p-l-lg" flex="none">
                <Form.Item
                  className="m-b-0"
                  name="enableQueryChangeEvents"
                  valuePropName="checked">
                  <Switch data-testid="enable-query-change-events-switch" />
                </Form.Item>
              </Col>
            </Row>
          </Col>
          <Col span={24}>
            <div className="d-flex justify-end gap-2">
              <Button data-testid="cancel-button" onClick={() => navigate(-1)}>
                {t('label.cancel')}
              </Button>
              <Button
                data-testid="save-button"
                htmlType="submit"
                loading={isFormSubmitting}
                type="primary">
                {t('label.save')}
              </Button>
            </div>
          </Col>
        </Row>
      </Form>
    </PageLayoutV1>
  );
};

export default NotificationSettingsPage;

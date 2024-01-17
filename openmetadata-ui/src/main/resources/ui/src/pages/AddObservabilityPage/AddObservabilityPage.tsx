/*
 *  Copyright 2024 Collate.
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

import { Col, Form, Input, Row, Typography } from 'antd';
import { FormProviderProps } from 'antd/lib/form/context';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import { isEmpty, isEqual, isNil } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import RichTextEditor from '../../components/common/RichTextEditor/RichTextEditor';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { HTTP_STATUS_CODE } from '../../constants/Auth.constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { ENTITY_NAME_REGEX } from '../../constants/regex.constants';
import { ProviderType } from '../../generated/entity/bot';
import {
  AlertType,
  EventSubscription,
} from '../../generated/events/eventSubscription';
import { FilterResourceDescriptor } from '../../generated/events/filterResourceDescriptor';
import {
  createObservabilityAlert,
  getResourceFunctions,
} from '../../rest/observabilityAPI';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './add-observability-page.less';
import ObservabilityFormActionItem from './ObservabilityFormActionItem/ObservabilityFormActionItem';
import ObservabilityFormFiltersItem from './ObservabilityFormFiltersItem/ObservabilityFormFiltersItem';
import {
  default as NotificationFormTriggerItem,
  default as ObservabilityFormTriggerItem,
} from './ObservabilityFormTriggerItem/ObservabilityFormTriggerItem';

function AddObservabilityPage() {
  const { t } = useTranslation();
  const history = useHistory();
  const [form] = useForm<EventSubscription>();
  const [loadingCount, setLoadingCount] = useState(0);
  const [filterResources, setFilterResources] = useState<
    FilterResourceDescriptor[]
  >([]);
  // To block certain action based on provider of the Alert e.g. System / User
  const [provider, setProvider] = useState<ProviderType>(ProviderType.User);

  const notificationsPath = getSettingPath(
    GlobalSettingsMenuCategory.NOTIFICATIONS,
    GlobalSettingOptions.ALERT
  );

  const breadcrumb = useMemo(
    () => [
      {
        name: t('label.setting-plural'),
        url: notificationsPath,
      },
      {
        name: t('label.observability'),
        url: '',
      },
    ],
    [notificationsPath]
  );

  const fetchFunctions = async () => {
    try {
      setLoadingCount((count) => count + 1);
      const filterResources = await getResourceFunctions();

      setFilterResources(filterResources.data);
    } finally {
      setLoadingCount((count) => count - 1);
    }
  };

  useEffect(() => {
    fetchFunctions();
  }, []);

  const handleSave = async (data: EventSubscription) => {
    try {
      await createObservabilityAlert({
        ...data,
        alertType: AlertType.ChangeEvent,
      });

      showSuccessToast(
        t(`server.${'create'}-entity-success`, {
          entity: t('label.alert-plural'),
        })
      );
      history.push(
        getSettingPath(
          GlobalSettingsMenuCategory.NOTIFICATIONS,
          // We need this check to have correct redirection after updating the subscription
          alert?.name === 'ActivityFeedAlert'
            ? GlobalSettingOptions.ACTIVITY_FEED
            : GlobalSettingOptions.ALERTS
        )
      );
    } catch (error) {
      if (
        (error as AxiosError).response?.status === HTTP_STATUS_CODE.CONFLICT
      ) {
        showErrorToast(
          t('server.entity-already-exist', {
            entity: t('label.alert'),
            entityPlural: t('label.alert-lowercase-plural'),
            name: data.name,
          })
        );
      } else {
        showErrorToast(
          error as AxiosError,
          t(`server.${'entity-creation-error'}`, {
            entity: t('label.alert-lowercase'),
          })
        );
      }
    }
  };

  const handleFormChange: FormProviderProps['onFormChange'] = (
    name,
    { changedFields, forms }
  ) => {
    const { mainForm, filtersForm } = forms;
    const filteredFormData = changedFields.find((fieldData) =>
      isEqual(fieldData.name, ['filteringRules', 'resources'])
    );

    if (!isEmpty(filteredFormData) && !isNil(filteredFormData)) {
      filtersForm.resetFields([['observability', 'filters']]);
      filtersForm.resetFields([['observability', 'actions']]);
    }
  };

  return (
    <Row className="add-notification-container" gutter={[24, 24]}>
      <Col span={24}>
        <TitleBreadcrumb titleLinks={breadcrumb} />
      </Col>

      <Col span={24}>
        <Typography.Title level={5}>
          {t('label.create-entity', { entity: t('label.observability') })}
        </Typography.Title>
        <Typography.Text>{t('message.alerts-description')}</Typography.Text>
      </Col>

      <Col span={24}>
        <Form.Provider onFormChange={handleFormChange}>
          <Form<EventSubscription>
            form={form}
            name="mainForm"
            onFinish={handleSave}>
            <Row gutter={[20, 20]}>
              <Col span={24}>
                <Form.Item
                  label={t('label.name')}
                  labelCol={{ span: 24 }}
                  name="name"
                  rules={[
                    { required: true },
                    {
                      pattern: ENTITY_NAME_REGEX,
                      message: t('message.entity-name-validation'),
                    },
                  ]}>
                  <Input placeholder={t('label.name')} />
                </Form.Item>
              </Col>
              <Col span={24}>
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
              </Col>
              <Col span={24}>
                <ObservabilityFormTriggerItem
                  buttonLabel={t('add-entity', {
                    entity: t('label.trigger'),
                  })}
                  filterResources={filterResources}
                  heading={t('label.trigger')}
                  subHeading={t('message.alerts-trigger-description')}
                />
              </Col>
              <Col span={24}>
                <ObservabilityFormFiltersItem
                  filterResources={filterResources}
                  form={form}
                  heading={t('label.filter-plural')}
                  subHeading={t('message.alerts-filter-description')}
                />
              </Col>
              <Col span={24}>
                <ObservabilityFormActionItem
                  filterResources={filterResources}
                  form={form}
                  heading={t('label.action-plural')}
                  subHeading={t('message.alerts-filter-description')}
                />
              </Col>
              <Col span={24}>
                <NotificationFormTriggerItem
                  buttonLabel={t('add-entity', {
                    entity: t('label.destination'),
                  })}
                  filterResources={filterResources}
                  heading={t('label.destination')}
                  subHeading={t('message.alerts-destination-description')}
                />
              </Col>
            </Row>
          </Form>
        </Form.Provider>
      </Col>
    </Row>
  );
}

export default AddObservabilityPage;

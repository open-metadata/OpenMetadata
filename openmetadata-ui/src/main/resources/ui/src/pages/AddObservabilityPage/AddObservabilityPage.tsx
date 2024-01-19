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

import { Button, Col, Form, Input, Row, Typography } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import { map, startCase } from 'lodash';
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
import { CreateEventSubscription } from '../../generated/events/api/createEventSubscription';
import {
  AlertType,
  ProviderType,
  SubscriptionType,
} from '../../generated/events/eventSubscription';
import { FilterResourceDescriptor } from '../../generated/events/filterResourceDescriptor';
import {
  createObservabilityAlert,
  getResourceFunctions,
} from '../../rest/observabilityAPI';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './add-observability-page.less';
import DestinationFormItem from './DestinationFormItem/DestinationFormItem.component';
import ObservabilityFormActionItem from './ObservabilityFormActionItem/ObservabilityFormActionItem';
import ObservabilityFormFiltersItem from './ObservabilityFormFiltersItem/ObservabilityFormFiltersItem';
import { default as ObservabilityFormTriggerItem } from './ObservabilityFormTriggerItem/ObservabilityFormTriggerItem';

function AddObservabilityPage() {
  const { t } = useTranslation();
  const history = useHistory();
  const [form] = useForm<CreateEventSubscription>();

  const [filterResources, setFilterResources] = useState<
    FilterResourceDescriptor[]
  >([]);

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
      const filterResources = await getResourceFunctions();

      setFilterResources(filterResources.data);
    } catch (error) {
      // TODO: Handle error
    }
  };

  useEffect(() => {
    fetchFunctions();
  }, []);

  const handleSave = async (data: CreateEventSubscription) => {
    try {
      const resources = [data.resources as unknown as string];
      await createObservabilityAlert({
        ...data,
        resources,
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
        <Form<CreateEventSubscription> form={form} onFinish={handleSave}>
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
                buttonLabel={t('label.add-entity', {
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
                heading={t('label.filter-plural')}
                subHeading={t('message.alerts-filter-description')}
              />
            </Col>
            <Col span={24}>
              <ObservabilityFormActionItem
                filterResources={filterResources}
                heading={t('label.action-plural')}
                subHeading={t('message.alerts-filter-description')}
              />
            </Col>
            <Form.Item
              hidden
              initialValue={AlertType.Observability}
              name="alertType"
            />
            <Form.Item
              hidden
              initialValue={ProviderType.User}
              name="provider"
            />
            <Col span={24}>
              <DestinationFormItem
                buttonLabel={t('label.add-entity', {
                  entity: t('label.destination'),
                })}
                filterResources={map(SubscriptionType, (type) => ({
                  label: startCase(type),
                  value: type,
                }))}
                heading={t('label.destination')}
                subHeading={t('message.alerts-destination-description')}
              />
            </Col>
            <Col span={24}>
              <Button className="m-r-sm" htmlType="submit">
                {t('label.save')}
              </Button>
              <Button onClick={() => history.goBack()}>
                {t('label.cancel')}
              </Button>
            </Col>
          </Row>
        </Form>
      </Col>
    </Row>
  );
}

export default AddObservabilityPage;

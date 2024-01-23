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
import { filter, startCase } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import RichTextEditor from '../../components/common/RichTextEditor/RichTextEditor';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import Loader from '../../components/Loader/Loader';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { HTTP_STATUS_CODE } from '../../constants/Auth.constants';
import { ROUTES } from '../../constants/constants';
import { ENTITY_NAME_REGEX } from '../../constants/regex.constants';
import { CreateEventSubscription } from '../../generated/events/api/createEventSubscription';
import {
  AlertType,
  EventSubscription,
  ProviderType,
  SubscriptionType,
} from '../../generated/events/eventSubscription';
import { FilterResourceDescriptor } from '../../generated/events/filterResourceDescriptor';
import { useFqn } from '../../hooks/useFqn';
import {
  createObservabilityAlert,
  getObservabilityAlertByFQN,
  getResourceFunctions,
} from '../../rest/observabilityAPI';
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
  const { fqn } = useFqn();

  const [filterResources, setFilterResources] = useState<
    FilterResourceDescriptor[]
  >([]);

  const [alert, setAlert] = useState<EventSubscription>();
  const [fetching, setFetching] = useState<number>(0);
  const [saving, setSaving] = useState<boolean>(false);

  const fetchAlerts = async () => {
    try {
      const observabilityAlert = await getObservabilityAlertByFQN(fqn);

      setAlert(observabilityAlert);
    } catch (error) {
      // Error handling
    } finally {
      setFetching((prev) => prev - 1);
    }
  };

  const fetchFunctions = async () => {
    try {
      setFetching((prev) => prev + 1);
      const filterResources = await getResourceFunctions();

      setFilterResources(filterResources.data);
    } catch (error) {
      // TODO: Handle error
    } finally {
      setFetching((prev) => prev - 1);
    }
  };

  useEffect(() => {
    fetchFunctions();
    if (!fqn) {
      return;
    }
    setFetching((prev) => prev + 1);
    fetchAlerts();
  }, [fqn]);

  const breadcrumb = useMemo(
    () => [
      {
        name: t('label.observability'),
        url: '',
      },
      {
        name: t('label.alert-plural'),
        url: ROUTES.OBSERVABILITY_ALERTS,
      },
      {
        name: t('label.create-entity', { entity: t('label.alert') }),
        url: '',
      },
    ],
    []
  );

  const handleSave = async (data: CreateEventSubscription) => {
    try {
      setSaving(true);

      const destinations = data.destinations?.map((d) => ({
        type: d.type,
        config: d.config,
        category: d.category,
      }));

      await createObservabilityAlert({
        ...data,
        destinations,
      });

      showSuccessToast(
        t(`server.${'create'}-entity-success`, {
          entity: t('label.alert-plural'),
        })
      );
      history.push(ROUTES.OBSERVABILITY_ALERTS);
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
    } finally {
      setSaving(false);
    }
  };

  const destinationResources = filter(
    SubscriptionType,
    (value) => value !== SubscriptionType.ActivityFeed
  ).map((value) => ({
    label: startCase(value),
    value,
  }));

  if (fetching) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle="Observability">
      <Row
        className="add-notification-container p-x-lg p-t-md"
        gutter={[16, 16]}>
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
          <Form<CreateEventSubscription>
            form={form}
            initialValues={{
              ...alert,
              resources: alert?.filteringRules?.resources,
            }}
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
                  filterResources={destinationResources}
                  heading={t('label.destination')}
                  subHeading={t('message.alerts-destination-description')}
                />
              </Col>
              <Col flex="auto" />
              <Col flex="300px" pull="right">
                <Button
                  className="m-l-sm float-right"
                  htmlType="submit"
                  loading={saving}
                  type="primary">
                  {t('label.save')}
                </Button>
                <Button
                  className="float-right"
                  onClick={() => history.goBack()}>
                  {t('label.cancel')}
                </Button>
              </Col>
            </Row>
          </Form>
        </Col>
      </Row>
    </PageLayoutV1>
  );
}

export default AddObservabilityPage;

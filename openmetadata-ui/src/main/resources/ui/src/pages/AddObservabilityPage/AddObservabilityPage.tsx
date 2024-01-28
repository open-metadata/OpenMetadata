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
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import RichTextEditor from '../../components/common/RichTextEditor/RichTextEditor';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import Loader from '../../components/Loader/Loader';
import { HTTP_STATUS_CODE } from '../../constants/Auth.constants';
import { ROUTES } from '../../constants/constants';
import { ENTITY_NAME_REGEX } from '../../constants/regex.constants';
import { CreateEventSubscription } from '../../generated/events/api/createEventSubscription';
import {
  AlertType,
  ProviderType,
  SubscriptionCategory,
} from '../../generated/events/eventSubscription';
import { FilterResourceDescriptor } from '../../generated/events/filterResourceDescriptor';
import { useFqn } from '../../hooks/useFqn';
import {
  createObservabilityAlert,
  getObservabilityAlertByFQN,
  getResourceFunctions,
  updateObservabilityAlert,
} from '../../rest/observabilityAPI';
import { getObservabilityAlertDetailsPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './add-observability-page.less';
import { ModifiedEventSubscription } from './AddObservabilityPage.interface';
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

  const [alert, setAlert] = useState<ModifiedEventSubscription>();
  const [fetching, setFetching] = useState<number>(0);
  const [saving, setSaving] = useState<boolean>(false);

  const fetchAlerts = async () => {
    try {
      const observabilityAlert = await getObservabilityAlertByFQN(fqn);
      const modifiedAlertData: ModifiedEventSubscription = {
        ...observabilityAlert,
        destinations: observabilityAlert.destinations.map((destination) => {
          const isExternalDestination =
            destination.category === SubscriptionCategory.External;

          return {
            ...destination,
            destinationType: isExternalDestination
              ? destination.type
              : destination.category,
          };
        }),
      };

      setAlert(modifiedAlertData);
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
      showErrorToast(
        t('server.entity-fetch-error', { entity: t('label.config') })
      );
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
        name: fqn
          ? t('label.edit-entity', { entity: t('label.alert') })
          : t('label.create-entity', { entity: t('label.alert') }),
        url: '',
      },
    ],
    [fqn]
  );

  const handleSave = async (data: CreateEventSubscription) => {
    try {
      setSaving(true);

      const destinations = data.destinations?.map((d) => ({
        type: d.type,
        config: d.config,
        category: d.category,
      }));

      if (fqn && !isUndefined(alert)) {
        const { resources, ...otherData } = data;

        // Remove 'destinationType' field from the `destination` as it is used for internal UI use
        const initialDestinations = alert.destinations.map((d) => {
          const { destinationType, ...originalData } = d;

          return originalData;
        });

        const jsonPatch = compare(
          { ...alert, destinations: initialDestinations },
          {
            ...alert,
            ...otherData,
            filteringRules: {
              ...alert.filteringRules,
              resources,
            },
            destinations,
          }
        );

        await updateObservabilityAlert(alert.id, jsonPatch);
      } else {
        await createObservabilityAlert({
          ...data,
          destinations,
        });
      }

      showSuccessToast(
        t(`server.${'create'}-entity-success`, {
          entity: t('label.alert-plural'),
        })
      );
      history.push(getObservabilityAlertDetailsPath(data.name));
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

  const [selectedTrigger] =
    Form.useWatch<CreateEventSubscription['resources']>(['resources'], form) ??
    [];

  const supportedFilters = useMemo(
    () =>
      filterResources.find((resource) => resource.name === selectedTrigger)
        ?.supportedFilters,
    [filterResources, selectedTrigger]
  );

  const supportedActions = useMemo(
    () =>
      filterResources.find((resource) => resource.name === selectedTrigger)
        ?.supportedActions,
    [filterResources, selectedTrigger]
  );

  const shouldShowFiltersSection = useMemo(
    () => (selectedTrigger ? !isEmpty(supportedFilters) : true),
    [selectedTrigger, supportedFilters]
  );

  const shouldShowActionsSection = useMemo(
    () => (selectedTrigger ? !isEmpty(supportedActions) : true),
    [selectedTrigger, supportedActions]
  );

  if (fetching) {
    return <Loader />;
  }

  return (
    <ResizablePanels
      hideSecondPanel
      firstPanel={{
        children: (
          <div className="alert-page-container">
            <Row className="p-x-lg p-t-md" gutter={[16, 16]}>
              <Col span={24}>
                <TitleBreadcrumb titleLinks={breadcrumb} />
              </Col>

              <Col span={24}>
                <Typography.Title level={5}>
                  {t(`label.${fqn ? 'edit' : 'add'}-entity`, {
                    entity: t('label.alert'),
                  })}
                </Typography.Title>
                <Typography.Text>
                  {t('message.alerts-description')}
                </Typography.Text>
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
                        filterResources={filterResources}
                      />
                    </Col>
                    {shouldShowFiltersSection && (
                      <Col span={24}>
                        <ObservabilityFormFiltersItem
                          supportedFilters={supportedFilters}
                        />
                      </Col>
                    )}
                    {shouldShowActionsSection && (
                      <Col span={24}>
                        <ObservabilityFormActionItem
                          supportedActions={supportedActions}
                        />
                      </Col>
                    )}
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
                        heading={t('label.destination')}
                        subHeading={t('message.alerts-destination-description')}
                      />
                    </Col>
                    <Col flex="auto" />
                    <Col flex="300px" pull="right">
                      <Button
                        className="m-l-sm float-right"
                        data-testid="save-button"
                        htmlType="submit"
                        loading={saving}
                        type="primary">
                        {t('label.save')}
                      </Button>
                      <Button
                        className="float-right"
                        data-testid="cancel-button"
                        onClick={() => history.goBack()}>
                        {t('label.cancel')}
                      </Button>
                    </Col>
                  </Row>
                </Form>
              </Col>
            </Row>
          </div>
        ),
        minWidth: 700,
        flex: 0.7,
      }}
      pageTitle={t('label.entity-detail-plural', { entity: t('label.alert') })}
      secondPanel={{ children: <></>, minWidth: 0 }}
    />
  );
}

export default AddObservabilityPage;

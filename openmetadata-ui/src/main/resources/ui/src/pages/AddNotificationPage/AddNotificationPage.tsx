/* eslint-disable @typescript-eslint/ban-types */
/*
 *  Copyright 2022 Collate.
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
import { Button, Col, Form, Input, Row, Skeleton, Typography } from 'antd';
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
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { ENTITY_NAME_REGEX } from '../../constants/regex.constants';
import { CreateEventSubscription } from '../../generated/events/api/createEventSubscription';
import {
  AlertType,
  EventSubscription,
  ProviderType,
  SubscriptionCategory,
} from '../../generated/events/eventSubscription';
import { FilterResourceDescriptor } from '../../generated/events/filterResourceDescriptor';
import { useFqn } from '../../hooks/useFqn';
import {
  createNotificationAlert,
  getAlertsFromName,
  getResourceFunctions,
  updateNotificationAlert,
} from '../../rest/alertsAPI';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { ModifiedEventSubscription } from '../AddObservabilityPage/AddObservabilityPage.interface';
import DestinationFormItem from '../AddObservabilityPage/DestinationFormItem/DestinationFormItem.component';
import ObservabilityFormFiltersItem from '../AddObservabilityPage/ObservabilityFormFiltersItem/ObservabilityFormFiltersItem';
import ObservabilityFormTriggerItem from '../AddObservabilityPage/ObservabilityFormTriggerItem/ObservabilityFormTriggerItem';
import './add-alerts-page.styles.less';

const AddNotificationPage = () => {
  const { t } = useTranslation();
  const [form] = useForm<EventSubscription>();
  const history = useHistory();
  const { fqn } = useFqn();

  const [loadingCount, setLoadingCount] = useState(0);
  const [entityFunctions, setEntityFunctions] = useState<
    FilterResourceDescriptor[]
  >([]);
  const [isButtonLoading, setIsButtonLoading] = useState<boolean>(false);
  const [alert, setAlert] = useState<ModifiedEventSubscription>();

  const breadcrumb = useMemo(
    () => [
      {
        name: t('label.setting-plural'),
        url: ROUTES.SETTINGS,
      },
      {
        name: t('label.notification-plural'),
        url: getSettingPath(GlobalSettingsMenuCategory.NOTIFICATIONS),
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

  const fetchAlerts = async () => {
    try {
      setLoadingCount((count) => count + 1);

      const response: EventSubscription = await getAlertsFromName(fqn);
      const modifiedAlertData: ModifiedEventSubscription = {
        ...response,
        destinations: response.destinations.map((destination) => {
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
    } catch {
      showErrorToast(
        t('server.entity-fetch-error', { entity: t('label.alert') }),
        fqn
      );
    } finally {
      setLoadingCount((count) => count - 1);
    }
  };

  const fetchFunctions = async () => {
    try {
      setLoadingCount((count) => count + 1);

      const entityFunctions = await getResourceFunctions();

      setEntityFunctions(entityFunctions.data);
    } finally {
      setLoadingCount((count) => count - 1);
    }
  };

  useEffect(() => {
    fetchFunctions();
    if (!fqn) {
      return;
    }
    fetchAlerts();
  }, [fqn]);

  const isEditMode = useMemo(() => !isEmpty(fqn), [fqn]);

  const handleSave = async (data: CreateEventSubscription) => {
    try {
      setIsButtonLoading(true);

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

        await updateNotificationAlert(alert.id, jsonPatch);
      } else {
        await createNotificationAlert({
          ...data,
          destinations,
        });
      }

      showSuccessToast(
        t(`server.${isEditMode ? 'update' : 'create'}-entity-success`, {
          entity: t('label.alert-plural'),
        })
      );
      history.push(getSettingPath(GlobalSettingsMenuCategory.NOTIFICATIONS));
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
          t(
            `server.${
              isEditMode ? 'entity-updating-error' : 'entity-creation-error'
            }`,
            {
              entity: t('label.alert-lowercase'),
            }
          )
        );
      }
    } finally {
      setIsButtonLoading(false);
    }
  };

  const [selectedTrigger] =
    Form.useWatch<CreateEventSubscription['resources']>(['resources'], form) ??
    [];

  const supportedFilters = useMemo(
    () =>
      entityFunctions.find((resource) => resource.name === selectedTrigger)
        ?.supportedFilters,
    [entityFunctions, selectedTrigger]
  );

  const shouldShowFiltersSection = useMemo(
    () => (selectedTrigger ? !isEmpty(supportedFilters) : true),
    [selectedTrigger, supportedFilters]
  );

  if (loadingCount) {
    return <Loader />;
  }

  return (
    <ResizablePanels
      hideSecondPanel
      firstPanel={{
        children: (
          <div className="alert-page-container">
            <Row className="page-container" gutter={[16, 16]}>
              <Col span={24}>
                <TitleBreadcrumb titleLinks={breadcrumb} />
              </Col>

              <Col span={24}>
                <Typography.Title level={5}>
                  {isEditMode
                    ? t('label.edit-entity', {
                        entity: t('label.alert-plural'),
                      })
                    : t('label.create-entity', {
                        entity: t('label.alert-plural'),
                      })}
                </Typography.Title>
                <Typography.Text>
                  {t('message.alerts-description')}
                </Typography.Text>
              </Col>
              <Col span={24}>
                <Form<CreateEventSubscription>
                  className="alerts-notification-form"
                  form={form}
                  initialValues={{
                    ...alert,
                    resources: alert?.filteringRules?.resources,
                  }}
                  onFinish={handleSave}>
                  {loadingCount > 0 ? (
                    <Skeleton title paragraph={{ rows: 8 }} />
                  ) : (
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
                          filterResources={entityFunctions}
                          heading={t('label.trigger')}
                          subHeading={t('message.alerts-trigger-description')}
                        />
                      </Col>
                      {shouldShowFiltersSection && (
                        <Col span={24}>
                          <ObservabilityFormFiltersItem
                            supportedFilters={supportedFilters}
                          />
                        </Col>
                      )}
                      <Form.Item
                        hidden
                        initialValue={AlertType.Notification}
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
                          subHeading={t(
                            'message.alerts-destination-description'
                          )}
                        />
                      </Col>
                      <Col flex="auto" />
                      <Col flex="300px" pull="right">
                        <Button
                          className="m-l-sm float-right"
                          htmlType="submit"
                          loading={isButtonLoading}
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
                  )}
                </Form>
              </Col>
              <Col span={24} />
              <Col span={24} />
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
};

export default AddNotificationPage;

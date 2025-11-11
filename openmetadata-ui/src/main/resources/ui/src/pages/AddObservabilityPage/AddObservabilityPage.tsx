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

import { Button, Card, Col, Divider, Form, Input, Row, Typography } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { isEmpty, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AlertFormSourceItem from '../../components/Alerts/AlertFormSourceItem/AlertFormSourceItem';
import DestinationFormItem from '../../components/Alerts/DestinationFormItem/DestinationFormItem.component';
import ObservabilityFormFiltersItem from '../../components/Alerts/ObservabilityFormFiltersItem/ObservabilityFormFiltersItem';
import ObservabilityFormTriggerItem from '../../components/Alerts/ObservabilityFormTriggerItem/ObservabilityFormTriggerItem';
import InlineAlert from '../../components/common/InlineAlert/InlineAlert';
import Loader from '../../components/common/Loader/Loader';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import RichTextEditor from '../../components/common/RichTextEditor/RichTextEditor';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { ROUTES, VALIDATION_MESSAGES } from '../../constants/constants';
import { NAME_FIELD_RULES } from '../../constants/Form.constants';
import { useLimitStore } from '../../context/LimitsProvider/useLimitsStore';
import { CreateEventSubscription } from '../../generated/events/api/createEventSubscription';
import {
  AlertType,
  EventSubscription,
  ProviderType,
} from '../../generated/events/eventSubscription';
import { FilterResourceDescriptor } from '../../generated/events/filterResourceDescriptor';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import {
  createObservabilityAlert,
  getObservabilityAlertByFQN,
  getResourceFunctions,
  updateObservabilityAlert,
} from '../../rest/observabilityAPI';
import {
  getModifiedAlertDataForForm,
  handleAlertSave,
} from '../../utils/Alerts/AlertsUtil';
import { getEntityName } from '../../utils/EntityUtils';
import { getObservabilityAlertDetailsPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  ModifiedCreateEventSubscription,
  ModifiedEventSubscription,
} from './AddObservabilityPage.interface';

function AddObservabilityPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form] = useForm<ModifiedCreateEventSubscription>();
  const { fqn } = useFqn();
  const { setInlineAlertDetails, inlineAlertDetails, currentUser } =
    useApplicationStore();

  const [filterResources, setFilterResources] = useState<
    FilterResourceDescriptor[]
  >([]);

  const [alert, setAlert] = useState<ModifiedEventSubscription>();
  const [initialData, setInitialData] = useState<EventSubscription>();
  const [fetching, setFetching] = useState<number>(0);
  const [saving, setSaving] = useState<boolean>(false);

  const isEditMode = useMemo(() => !isEmpty(fqn), [fqn]);
  const { getResourceLimit } = useLimitStore();

  const fetchAlert = async () => {
    try {
      setFetching((prev) => prev + 1);

      const observabilityAlert = await getObservabilityAlertByFQN(fqn);
      const modifiedAlertData = getModifiedAlertDataForForm(observabilityAlert);

      setInitialData(observabilityAlert);
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
    fetchAlert();
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

  const handleSave = useCallback(
    async (data: ModifiedCreateEventSubscription) => {
      try {
        setSaving(true);

        await handleAlertSave({
          data,
          fqn,
          initialData,
          currentUser,
          createAlertAPI: createObservabilityAlert,
          updateAlertAPI: updateObservabilityAlert,
          afterSaveAction: async (fqn: string) => {
            !fqn && (await getResourceLimit('eventsubscription', true, true));
            navigate(getObservabilityAlertDetailsPath(fqn));
          },
          setInlineAlertDetails,
        });
      } catch {
        // Error handling done in "handleAlertSave"
      } finally {
        setSaving(false);
      }
    },
    [fqn, navigate, initialData, currentUser]
  );

  const [selectedTrigger] =
    Form.useWatch<CreateEventSubscription['resources']>(['resources'], form) ??
    [];

  const supportedFilters = useMemo(
    () =>
      filterResources.find((resource) => resource.name === selectedTrigger)
        ?.supportedFilters,
    [filterResources, selectedTrigger]
  );

  const supportedTriggers = useMemo(
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
    () => (selectedTrigger ? !isEmpty(supportedTriggers) : true),
    [selectedTrigger, supportedTriggers]
  );

  if (fetching || (isEditMode && isEmpty(alert))) {
    return <Loader />;
  }

  return (
    <ResizablePanels
      hideSecondPanel
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container ',
        allowScroll: true,
        children: (
          <Card className="steps-form-container">
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <TitleBreadcrumb titleLinks={breadcrumb} />
              </Col>

              <Col span={24}>
                <Typography.Title level={5}>
                  {t(`label.${isEditMode ? 'edit' : 'add'}-entity`, {
                    entity: t('label.alert'),
                  })}
                </Typography.Title>
                <Typography.Text>
                  {t('message.alerts-description')}
                </Typography.Text>
              </Col>

              <Col span={24}>
                <Form<ModifiedCreateEventSubscription>
                  form={form}
                  initialValues={{
                    ...alert,
                    displayName: getEntityName(alert),
                    resources: alert?.filteringRules?.resources,
                  }}
                  validateMessages={VALIDATION_MESSAGES}
                  onFinish={handleSave}>
                  <Row gutter={[20, 20]}>
                    <Col span={24}>
                      <Form.Item
                        label={t('label.name')}
                        labelCol={{ span: 24 }}
                        name="displayName"
                        rules={NAME_FIELD_RULES}>
                        <Input placeholder={t('label.name')} />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item
                        label={t('label.description')}
                        labelCol={{ span: 24 }}
                        name="description"
                        trigger="onTextChange">
                        <RichTextEditor
                          data-testid="description"
                          initialValue={alert?.description}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Row justify="center">
                        <Col span={24}>
                          <AlertFormSourceItem
                            filterResources={filterResources}
                          />
                        </Col>
                        {shouldShowFiltersSection && (
                          <>
                            <Col>
                              <Divider dashed type="vertical" />
                            </Col>
                            <Col span={24}>
                              <ObservabilityFormFiltersItem
                                supportedFilters={supportedFilters}
                              />
                            </Col>
                          </>
                        )}
                        {shouldShowActionsSection && (
                          <>
                            <Col>
                              <Divider dashed type="vertical" />
                            </Col>
                            <Col span={24}>
                              <ObservabilityFormTriggerItem
                                supportedTriggers={supportedTriggers}
                              />
                            </Col>
                          </>
                        )}
                        <Col>
                          <Divider dashed type="vertical" />
                        </Col>
                        <Col span={24}>
                          <DestinationFormItem />
                        </Col>
                      </Row>
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

                    {!isUndefined(inlineAlertDetails) && (
                      <Col span={24}>
                        <InlineAlert {...inlineAlertDetails} />
                      </Col>
                    )}

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
                        onClick={() => navigate(-1)}>
                        {t('label.cancel')}
                      </Button>
                    </Col>
                  </Row>
                </Form>
              </Col>
            </Row>
          </Card>
        ),
        minWidth: 700,
        flex: 0.7,
        wrapInCard: false,
      }}
      pageTitle={t('label.add-entity', {
        entity: t('label.observability'),
      })}
      secondPanel={{
        children: <></>,
        minWidth: 0,
        className: 'content-resizable-panel-container',
      }}
    />
  );
}

export default withPageLayout(AddObservabilityPage);

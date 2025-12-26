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
import { Button, Grid } from '@mui/material';
import {
  Card,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Skeleton,
  Typography,
} from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { isEmpty, isUndefined } from 'lodash';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AlertFormSourceItem from '../../components/Alerts/AlertFormSourceItem/AlertFormSourceItem';
import DestinationFormItem from '../../components/Alerts/DestinationFormItem/DestinationFormItem.component';
import ObservabilityFormFiltersItem from '../../components/Alerts/ObservabilityFormFiltersItem/ObservabilityFormFiltersItem';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import InlineAlert from '../../components/common/InlineAlert/InlineAlert';
import Loader from '../../components/common/Loader/Loader';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import RichTextEditor from '../../components/common/RichTextEditor/RichTextEditor';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import {
  PAGE_SIZE_LARGE,
  ROUTES,
  VALIDATION_MESSAGES,
} from '../../constants/constants';
import { NAME_FIELD_RULES } from '../../constants/Form.constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { useLimitStore } from '../../context/LimitsProvider/useLimitsStore';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import {
  NotificationTemplate,
  ProviderType,
} from '../../generated/entity/events/notificationTemplate';
import { Operation } from '../../generated/entity/policies/policy';
import { CreateEventSubscription } from '../../generated/events/api/createEventSubscription';
import {
  AlertType,
  EventSubscription,
} from '../../generated/events/eventSubscription';
import { FilterResourceDescriptor } from '../../generated/events/filterResourceDescriptor';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import {
  createNotificationAlert,
  getAlertsFromName,
  getResourceFunctions,
  updateNotificationAlert,
} from '../../rest/alertsAPI';
import { getAllNotificationTemplates } from '../../rest/notificationtemplateAPI';
import alertsClassBase from '../../utils/AlertsClassBase';
import { getEntityName } from '../../utils/EntityUtils';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedViewPermission,
} from '../../utils/PermissionsUtils';
import {
  getNotificationAlertDetailsPath,
  getSettingPath,
} from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  ModifiedCreateEventSubscription,
  ModifiedEventSubscription,
} from '../AddObservabilityPage/AddObservabilityPage.interface';
import { AddAlertPageLoadingState } from './AddNotificationPage.interface';

const AddNotificationPage = () => {
  const [form] = useForm<ModifiedCreateEventSubscription>();
  const navigate = useNavigate();
  const { fqn } = useFqn();
  const { t } = useTranslation();
  const { setInlineAlertDetails, inlineAlertDetails, currentUser } =
    useApplicationStore();
  const { getResourceLimit } = useLimitStore();

  const [loadingState, setLoadingState] = useState<AddAlertPageLoadingState>({
    alerts: false,
    functions: false,
    templates: false,
  });
  const [entityFunctions, setEntityFunctions] = useState<
    FilterResourceDescriptor[]
  >([]);
  const { getResourcePermission } = usePermissionProvider();
  const [isButtonLoading, setIsButtonLoading] = useState<boolean>(false);
  const [alert, setAlert] = useState<ModifiedEventSubscription>();
  const [initialData, setInitialData] = useState<EventSubscription>();
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [templateResourcePermission, setTemplateResourcePermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const isSystemProvider = useMemo(
    () => alert?.provider === ProviderType.System,
    [alert]
  );

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
        name: t('label.alert-plural'),
        url: getSettingPath(
          GlobalSettingsMenuCategory.NOTIFICATIONS,
          GlobalSettingOptions.ALERTS
        ),
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

  const fetchAlert = async () => {
    try {
      setLoadingState((state) => ({ ...state, alerts: true }));

      const response: EventSubscription = await getAlertsFromName(fqn);
      const modifiedAlertData: ModifiedEventSubscription =
        alertsClassBase.getModifiedAlertDataForForm(response);

      setInitialData(response);
      setAlert(modifiedAlertData);
    } catch {
      showErrorToast(
        t('server.entity-fetch-error', { entity: t('label.alert') }),
        fqn
      );
    } finally {
      setLoadingState((state) => ({ ...state, alerts: false }));
    }
  };

  const fetchFunctions = async () => {
    try {
      setLoadingState((state) => ({ ...state, functions: true }));

      const entityFunctions = await getResourceFunctions();

      setEntityFunctions(entityFunctions.data);
    } catch {
      showErrorToast(
        t('server.entity-fetch-error', { entity: t('label.config') })
      );
    } finally {
      setLoadingState((state) => ({ ...state, functions: false }));
    }
  };

  useEffect(() => {
    fetchFunctions();
    if (!fqn) {
      return;
    }
    fetchAlert();
  }, [fqn]);

  const isEditMode = useMemo(() => !isEmpty(fqn), [fqn]);

  const handleSave = useCallback(
    async (data: ModifiedCreateEventSubscription) => {
      try {
        setIsButtonLoading(true);

        await alertsClassBase.handleAlertSave({
          data,
          fqn,
          initialData,
          currentUser,
          createAlertAPI: createNotificationAlert,
          updateAlertAPI: updateNotificationAlert,
          afterSaveAction: async (fqn: string) => {
            !fqn && (await getResourceLimit('eventsubscription', true, true));
            navigate(getNotificationAlertDetailsPath(fqn));
          },
          setInlineAlertDetails,
        });
      } catch {
        // Error handling done in "handleAlertSave"
      } finally {
        setIsButtonLoading(false);
      }
    },
    [fqn, navigate, initialData, currentUser]
  );

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

  const extraFormWidgets = useMemo(
    () => alertsClassBase.getAddAlertFormExtraWidgets(),
    []
  );

  const extraFormButtons = useMemo(
    () => alertsClassBase.getAddAlertFormExtraButtons(),
    []
  );

  const fetchTemplates = useCallback(async () => {
    setLoadingState((state) => ({ ...state, templates: true }));
    try {
      const permission = await getResourcePermission(
        ResourceEntity.NOTIFICATION_TEMPLATE
      );

      setTemplateResourcePermission(permission);

      if (getPrioritizedViewPermission(permission, Operation.ViewAll)) {
        const { data } = await getAllNotificationTemplates({
          limit: PAGE_SIZE_LARGE,
          provider: ProviderType.User,
        });

        setTemplates(data);
      }
    } catch {
      showErrorToast(
        t('server.entity-fetch-error', { entity: t('label.template-plural') })
      );
    } finally {
      setLoadingState((state) => ({ ...state, templates: false }));
    }
  }, []);

  useEffect(() => {
    if (!isEmpty(extraFormWidgets)) {
      fetchTemplates();
    }
  }, [extraFormWidgets]);

  const isLoading = useMemo(
    () => Object.values(loadingState).some((val) => val),
    [loadingState]
  );

  if (isLoading || (isEditMode && isEmpty(alert))) {
    return <Loader />;
  }

  if (isSystemProvider) {
    return (
      <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
        <Typography.Paragraph
          className="tw-max-w-md"
          style={{ marginBottom: '0' }}>
          {t('message.system-alert-edit-message')}
        </Typography.Paragraph>
      </ErrorPlaceHolder>
    );
  }

  return (
    <ResizablePanels
      hideSecondPanel
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
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
                  className="alerts-notification-form"
                  form={form}
                  initialValues={{
                    ...alert,
                    displayName: getEntityName(alert),
                    resources: alert?.filteringRules?.resources,
                  }}
                  validateMessages={VALIDATION_MESSAGES}
                  onFinish={handleSave}>
                  {isLoading ? (
                    <Skeleton title paragraph={{ rows: 8 }} />
                  ) : (
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
                              filterResources={entityFunctions}
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
                          <Col>
                            <Divider dashed type="vertical" />
                          </Col>
                          <Col span={24}>
                            <DestinationFormItem />
                          </Col>

                          {!isEmpty(extraFormWidgets) && (
                            <>
                              {Object.entries(extraFormWidgets).map(
                                ([name, Widget]) => (
                                  <Fragment key={name}>
                                    <Col>
                                      <Divider dashed type="vertical" />
                                    </Col>
                                    <Col span={24}>
                                      <Widget
                                        alertDetails={alert}
                                        formRef={form}
                                        loading={isLoading}
                                        templateResourcePermission={
                                          templateResourcePermission
                                        }
                                        templates={templates}
                                      />
                                    </Col>
                                  </Fragment>
                                )
                              )}
                            </>
                          )}
                        </Row>
                      </Col>
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
                      <Form.Item hidden name="customNotificationTemplateData" />

                      {!isUndefined(inlineAlertDetails) && (
                        <Col span={24}>
                          <InlineAlert {...inlineAlertDetails} />
                        </Col>
                      )}

                      <Col span={24}>
                        <Grid container justifyContent="end" spacing={2}>
                          <Button
                            className="float-right"
                            data-testid="cancel-button"
                            variant="text"
                            onClick={() => navigate(-1)}>
                            {t('label.cancel')}
                          </Button>

                          {Object.entries(extraFormButtons).map(
                            ([name, ButtonComponent]) => (
                              <ButtonComponent
                                alertDetails={alert}
                                formRef={form}
                                key={name}
                                templateResourcePermission={
                                  templateResourcePermission
                                }
                                templates={templates}
                              />
                            )
                          )}
                          <Button
                            className="float-right"
                            data-testid="save-button"
                            loading={isButtonLoading}
                            type="submit"
                            variant="contained">
                            {t('label.save')}
                          </Button>
                        </Grid>
                      </Col>
                    </Row>
                  )}
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
        entity: t('label.notification-alert'),
      })}
      secondPanel={{
        children: <></>,
        minWidth: 0,
        className: 'content-resizable-panel-container',
      }}
    />
  );
};

export default withPageLayout(AddNotificationPage);

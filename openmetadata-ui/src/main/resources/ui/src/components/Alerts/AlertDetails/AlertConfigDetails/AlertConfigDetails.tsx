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

import { Col, Divider, Form, Row } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { isEmpty } from 'lodash';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_LARGE } from '../../../../constants/constants';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../../context/PermissionProvider/PermissionProvider.interface';
import {
  NotificationTemplate,
  ProviderType,
} from '../../../../generated/entity/events/notificationTemplate';
import { Operation } from '../../../../generated/entity/policies/policy';
import { AlertType as CapabilitiesAlertType } from '../../../../generated/events/api/alertCapabilitiesRequest';
import { FilterResourceDescriptor } from '../../../../generated/events/filterResourceDescriptor';
import {
  AlertSelectionProvider,
  useAlertSelection,
} from '../../../../hooks/useAlertSelection';
import { ModifiedCreateEventSubscription } from '../../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { getResourceFunctions as getNotificationResourceFunctions } from '../../../../rest/alertsAPI';
import { getAllNotificationTemplates } from '../../../../rest/notificationtemplateAPI';
import { getResourceFunctions } from '../../../../rest/observabilityAPI';
import alertsClassBase from '../../../../utils/AlertsClassBase';
import Fqn from '../../../../utils/Fqn';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedViewPermission,
} from '../../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import Loader from '../../../common/Loader/Loader';
import AlertFormSourceItem from '../../AlertFormSourceItem/AlertFormSourceItem';
import DestinationFormItemFormBridge, {
  DestinationFormFieldRegistrar,
} from '../../DestinationFormItem/DestinationFormItemFormBridge';
import ObservabilityFormFiltersItem from '../../ObservabilityFormFiltersItem/ObservabilityFormFiltersItem';
import ObservabilityFormTriggerItem from '../../ObservabilityFormTriggerItem/ObservabilityFormTriggerItem';
import './alert-config-details.less';
import {
  AlertConfigDetailsProps,
  AlertConfigLoadingState,
} from './AlertConfigDetails.interface';

function AlertConfigDetails({
  alertDetails,
  isNotificationAlert,
}: AlertConfigDetailsProps) {
  const { t } = useTranslation();
  const [form] = useForm<ModifiedCreateEventSubscription>();
  const destinations = Form.useWatch('destinations', form);
  const timeout = Form.useWatch('timeout', form);
  const readTimeout = Form.useWatch('readTimeout', form);
  const { getResourcePermission } = usePermissionProvider();
  const modifiedAlertData =
    alertsClassBase.getModifiedAlertDataForForm(alertDetails);
  const [loadingState, setLoadingState] = useState<AlertConfigLoadingState>({
    templates: false,
    functions: false,
  });
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [filterResources, setFilterResources] = useState<
    FilterResourceDescriptor[]
  >([]);
  const [templateResourcePermission, setTemplateResourcePermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const savedSources = useMemo(
    () => alertDetails.filteringRules?.resources ?? [],
    [alertDetails]
  );
  // Showing an alert asks nothing of the user, so a server that cannot answer is not reported.
  const selection = useAlertSelection({
    alertType: isNotificationAlert
      ? CapabilitiesAlertType.Notification
      : CapabilitiesAlertType.Observability,
    sources: savedSources,
    catalog: filterResources,
    quiet: true,
  });

  const fetchFunctions = useCallback(async () => {
    try {
      setLoadingState((prev) => ({ ...prev, functions: true }));
      const filterResources = await (isNotificationAlert
        ? getNotificationResourceFunctions()
        : getResourceFunctions());

      setFilterResources(filterResources.data);
    } catch (error) {
      showErrorToast(
        t('server.entity-fetch-error', { entity: t('label.config') })
      );
    } finally {
      setLoadingState((prev) => ({ ...prev, functions: false }));
    }
  }, [isNotificationAlert]);

  const extraFormWidgets = useMemo(
    () => alertsClassBase.getAddAlertFormExtraWidgets(),
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

  useEffect(() => {
    fetchFunctions();
  }, [Fqn]);

  const isLoading = useMemo(
    () => Object.values(loadingState).some((val) => val),
    [loadingState]
  );

  if (isLoading) {
    return <Loader />;
  }

  return (
    <AlertSelectionProvider value={selection}>
      <Form<ModifiedCreateEventSubscription>
        disabled
        className="alert-config-details"
        form={form}
        initialValues={{
          ...modifiedAlertData,
          resources: modifiedAlertData?.filteringRules?.resources,
        }}>
        <Row justify="center">
          <Col span={24}>
            <AlertFormSourceItem isViewMode />
          </Col>
          {!isEmpty(modifiedAlertData.input?.filters) && (
            <>
              <Col>
                <Divider dashed type="vertical" />
              </Col>
              <Col span={24}>
                <ObservabilityFormFiltersItem isViewMode />
              </Col>
            </>
          )}
          {!isEmpty(modifiedAlertData.input?.actions) && (
            <>
              <Col>
                <Divider dashed type="vertical" />
              </Col>
              <Col span={24}>
                <ObservabilityFormTriggerItem isViewMode />
              </Col>
            </>
          )}
          <Col>
            <Divider dashed type="vertical" />
          </Col>
          <Col span={24}>
            <DestinationFormItemFormBridge
              isViewMode
              renderValidationField={(validate) => (
                <Form.Item
                  hidden
                  name="destinations"
                  rules={[{ validator: validate }]}>
                  <DestinationFormFieldRegistrar />
                </Form.Item>
              )}
              values={{ destinations, readTimeout, timeout }}
              onChange={(values) => {
                // Keep this adapter replacement-based even in view mode so the
                // core form cannot be rehydrated with stale nested config.
                Object.entries(values).forEach(([name, value]) =>
                  form.setFieldValue(name, value)
                );
              }}
            />
          </Col>
          {!isEmpty(extraFormWidgets) && (
            <>
              {Object.entries(extraFormWidgets).map(([name, Widget]) => (
                <Fragment key={name}>
                  <Col>
                    <Divider dashed type="vertical" />
                  </Col>
                  <Col span={24}>
                    <Widget
                      isViewMode
                      alertDetails={modifiedAlertData}
                      formRef={form}
                      loading={isLoading}
                      templateResourcePermission={templateResourcePermission}
                      templates={templates}
                    />
                  </Col>
                </Fragment>
              ))}
            </>
          )}
        </Row>
      </Form>
    </AlertSelectionProvider>
  );
}

export default AlertConfigDetails;

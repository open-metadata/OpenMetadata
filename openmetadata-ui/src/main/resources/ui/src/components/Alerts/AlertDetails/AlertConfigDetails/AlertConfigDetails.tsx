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
import { FilterResourceDescriptor } from '../../../../generated/events/filterResourceDescriptor';
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
import DestinationFormItem from '../../DestinationFormItem/DestinationFormItem.component';
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

  const { supportedFilters, supportedTriggers } = useMemo(
    () => ({
      supportedFilters: filterResources.find(
        (resource) =>
          resource.name === alertDetails.filteringRules?.resources[0]
      )?.supportedFilters,
      supportedTriggers: filterResources.find(
        (resource) =>
          resource.name === alertDetails.filteringRules?.resources[0]
      )?.supportedActions,
    }),
    [filterResources, alertDetails]
  );

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
          <AlertFormSourceItem />
        </Col>
        {!isEmpty(modifiedAlertData.input?.filters) && (
          <>
            <Col>
              <Divider dashed type="vertical" />
            </Col>
            <Col span={24}>
              <ObservabilityFormFiltersItem
                isViewMode
                supportedFilters={supportedFilters}
              />
            </Col>
          </>
        )}
        {!isEmpty(modifiedAlertData.input?.actions) && (
          <>
            <Col>
              <Divider dashed type="vertical" />
            </Col>
            <Col span={24}>
              <ObservabilityFormTriggerItem
                isViewMode
                supportedTriggers={supportedTriggers}
              />
            </Col>
          </>
        )}
        <Col>
          <Divider dashed type="vertical" />
        </Col>
        <Col span={24}>
          <DestinationFormItem isViewMode />
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
  );
}

export default AlertConfigDetails;

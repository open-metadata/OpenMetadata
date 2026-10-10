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

import { Box, Divider } from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_LARGE } from '../../../../constants/constants';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import {
  NotificationTemplate,
  ProviderType,
} from '../../../../generated/entity/events/notificationTemplate';
import { AlertType as CapabilitiesAlertType } from '../../../../generated/events/api/alertCapabilitiesRequest';
import { FilterResourceDescriptor } from '../../../../generated/events/filterResourceDescriptor';
import {
  AlertSelectionProvider,
  useAlertSelection,
} from '../../../../hooks/useAlertSelection';
import { ModifiedCreateEventSubscription } from '../../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { getClassicAlertInitialValues } from '../../../../pages/AddObservabilityPage/components/ObservabilityAlertForm.utils';
import { getResourceFunctions as getNotificationResourceFunctions } from '../../../../rest/alertsAPI';
import { getAllNotificationTemplates } from '../../../../rest/notificationtemplateAPI';
import { getResourceFunctions } from '../../../../rest/observabilityAPI';
import alertsClassBase from '../../../../utils/AlertsClassBase';
import Fqn from '../../../../utils/Fqn';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
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
  const { getResourcePermission } = usePermissionProvider();
  const modifiedAlertData = useMemo(
    () =>
      getClassicAlertInitialValues(
        alertsClassBase.getModifiedAlertDataForForm(alertDetails)
      ),
    [alertDetails]
  );
  const form = useForm<ModifiedCreateEventSubscription>({
    defaultValues: modifiedAlertData,
  });
  const values = form.watch();
  const { reset } = form;
  useEffect(() => reset(modifiedAlertData), [modifiedAlertData, reset]);
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

      if (getDerivedPermissionFlags(permission).canViewAll) {
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
      <FormProvider {...form}>
        <Box className="alert-config-details" direction="col">
          <Box className="layout-row" justify="center" wrap="wrap">
            <Box
              className="layout-column tw:block"
              style={{ maxWidth: '100%', flex: '0 0 100%' }}>
              <AlertFormSourceItem isViewMode value={values.resources} />
            </Box>
            {!isEmpty(modifiedAlertData.input?.filters) && (
              <>
                <Box className="layout-column tw:block">
                  <Divider
                    dashed
                    className="tw:mx-2 tw:h-6 tw:border-r"
                    orientation="vertical"
                  />
                </Box>
                <Box
                  className="layout-column tw:block"
                  style={{ maxWidth: '100%', flex: '0 0 100%' }}>
                  <ObservabilityFormFiltersItem isViewMode value={values} />
                </Box>
              </>
            )}
            {!isEmpty(modifiedAlertData.input?.actions) && (
              <>
                <Box className="layout-column tw:block">
                  <Divider
                    dashed
                    className="tw:mx-2 tw:h-6 tw:border-r"
                    orientation="vertical"
                  />
                </Box>
                <Box
                  className="layout-column tw:block"
                  style={{ maxWidth: '100%', flex: '0 0 100%' }}>
                  <ObservabilityFormTriggerItem isViewMode value={values} />
                </Box>
              </>
            )}
            <Box className="layout-column tw:block">
              <Divider
                dashed
                className="tw:mx-2 tw:h-6 tw:border-r"
                orientation="vertical"
              />
            </Box>
            <Box
              className="layout-column tw:block"
              style={{ maxWidth: '100%', flex: '0 0 100%' }}>
              <DestinationFormItem isViewMode />
            </Box>
            {!isEmpty(extraFormWidgets) && (
              <>
                {Object.entries(extraFormWidgets).map(([name, Widget]) => (
                  <Fragment key={name}>
                    <Box className="layout-column tw:block">
                      <Divider
                        dashed
                        className="tw:mx-2 tw:h-6 tw:border-r"
                        orientation="vertical"
                      />
                    </Box>
                    <Box
                      className="layout-column tw:block"
                      style={{ maxWidth: '100%', flex: '0 0 100%' }}>
                      <Widget
                        isViewMode
                        alertDetails={alertsClassBase.getModifiedAlertDataForForm(
                          alertDetails
                        )}
                        loading={isLoading}
                        templateResourcePermission={templateResourcePermission}
                        templates={templates}
                        values={values}
                      />
                    </Box>
                  </Fragment>
                ))}
              </>
            )}
          </Box>
        </Box>
      </FormProvider>
    </AlertSelectionProvider>
  );
}

export default AlertConfigDetails;

/*
 *  Copyright 2026 Collate.
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

import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import { isEmpty, isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_READ_TIMEOUT } from '../../../../../../constants/Alerts.constants';
import { PAGE_SIZE_LARGE } from '../../../../../../constants/constants';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { useLimitStore } from '../../../../../../context/LimitsProvider/useLimitsStore';
import {
  NotificationTemplate,
  ProviderType as TemplateProviderType,
} from '../../../../../../generated/entity/events/notificationTemplate';
import {
  AlertType,
  EventSubscription,
  ProviderType,
} from '../../../../../../generated/events/eventSubscription';
import { useApplicationStore } from '../../../../../../hooks/useApplicationStore';
import {
  createNotificationAlert,
  getAlertsFromName,
  getResourceFunctions,
  updateNotificationAlert,
} from '../../../../../../rest/alertsAPI';
import { getAllNotificationTemplates } from '../../../../../../rest/notificationtemplateAPI';
import alertsClassBase from '../../../../../../utils/AlertsClassBase';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { getDerivedPermissionFlags } from '../../../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import Loader from '../../../../../common/Loader/Loader';
import AlertAiForm from '../../../../../observability/Alerts/AlertAiForm.component';
import {
  ALERT_AI_DEFAULT_CONNECTION_TIMEOUT,
  ALERT_AI_FORM_MODAL_ID,
} from '../../../../../observability/Alerts/AlertAiFormFields.constants';
import type {
  ModifiedCreateEventSubscription,
  ModifiedEventSubscription,
} from './Notification.types';
import { NotificationView } from './Notification.types';

interface NotificationAlertFormProps {
  fqn?: string;
  showHint?: boolean;
  onNavigate: (view: NotificationView) => void;
}

type ObservabilityFilterResourceDescriptor = {
  containerEntities?: string[];
  name?: string;
  supportedActions?: unknown[];
  supportedEventTypes?: string[];
  supportedFilters?: unknown[];
};

const getEmptyFormValues = (): ModifiedCreateEventSubscription => ({
  alertType: AlertType.Notification,
  destinations: [],
  displayName: '',
  input: { filters: [] },
  name: '',
  provider: ProviderType.User,
  readTimeout: DEFAULT_READ_TIMEOUT,
  resources: [],
  timeout: ALERT_AI_DEFAULT_CONNECTION_TIMEOUT,
});

const alertToFormValues = (
  alert: ModifiedEventSubscription
): ModifiedCreateEventSubscription => ({
  ...(alert as unknown as ModifiedCreateEventSubscription),
  alertType: alert.alertType ?? AlertType.Notification,
  destinations: alert.destinations ?? [],
  displayName: getEntityName(alert),
  name: alert.name ?? '',
  provider: alert.provider ?? ProviderType.User,
  readTimeout: alert.readTimeout ?? DEFAULT_READ_TIMEOUT,
  resources: (
    alert as unknown as { filteringRules?: { resources?: string[] } }
  ).filteringRules?.resources,
  timeout: alert.timeout ?? ALERT_AI_DEFAULT_CONNECTION_TIMEOUT,
});

const NotificationAlertForm: React.FC<NotificationAlertFormProps> = ({
  fqn,
  showHint = false,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const { setInlineAlertDetails, inlineAlertDetails, currentUser } =
    useApplicationStore();
  const { getResourceLimit } = useLimitStore();
  const { getResourcePermission } = usePermissionProvider();

  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterResources, setFilterResources] = useState<
    ObservabilityFilterResourceDescriptor[]
  >([]);
  const [alert, setAlert] = useState<ModifiedEventSubscription>();
  const [initialData, setInitialData] = useState<EventSubscription>();
  const [formData, setFormData] = useState<ModifiedCreateEventSubscription>(
    getEmptyFormValues
  );

  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [_templateResourcePermission, setTemplateResourcePermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const extraFormWidgets = useMemo(
    () => alertsClassBase.getAddAlertFormExtraWidgets(),
    []
  );

  const isEditMode = Boolean(fqn);

  const selectedTrigger = formData.resources?.[0];

  const resourceDescriptor = useMemo(
    () => filterResources.find((r) => r.name === selectedTrigger),
    [filterResources, selectedTrigger]
  );

  const shouldShowFiltersSection = useMemo(
    () =>
      selectedTrigger ? !isEmpty(resourceDescriptor?.supportedFilters) : true,
    [selectedTrigger, resourceDescriptor]
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [functionsResponse, alertResponse] = await Promise.allSettled([
        getResourceFunctions(),
        fqn ? getAlertsFromName(fqn) : Promise.resolve(null),
      ]);

      if (functionsResponse.status === 'fulfilled') {
        setFilterResources(
          functionsResponse.value
            .data as unknown as ObservabilityFilterResourceDescriptor[]
        );
      } else {
        showErrorToast(
          t('server.entity-fetch-error', { entity: t('label.config') })
        );
      }

      if (fqn && alertResponse.status === 'fulfilled' && alertResponse.value) {
        const rawAlert = alertResponse.value as EventSubscription;
        const modifiedAlert =
          alertsClassBase.getModifiedAlertDataForForm(rawAlert);

        setInitialData(rawAlert);
        setAlert(modifiedAlert);
        setFormData(alertToFormValues(modifiedAlert));
      } else if (fqn && alertResponse.status === 'rejected') {
        showErrorToast(
          t('server.entity-fetch-error', { entity: t('label.alert') })
        );
      }

      if (!isEmpty(extraFormWidgets)) {
        try {
          const permission = await getResourcePermission(
            ResourceEntity.NOTIFICATION_TEMPLATE
          );
          setTemplateResourcePermission(permission);
          const { canViewAll } = getDerivedPermissionFlags(permission);
          if (canViewAll) {
            const { data } = await getAllNotificationTemplates({
              limit: PAGE_SIZE_LARGE,
              provider: TemplateProviderType.User,
            });
            setTemplates(data);
          }
        } catch {
          // Templates are optional
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [fqn, t, extraFormWidgets, getResourcePermission]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isSystemProvider = useMemo(
    () => alert?.provider === ProviderType.System,
    [alert]
  );

  const handleSave = useCallback(
    async (data: ModifiedCreateEventSubscription) => {
      setSaving(true);
      try {
        await alertsClassBase.handleAlertSave({
          data,
          fqn: fqn ?? '',
          initialData,
          currentUser,
          createAlertAPI: createNotificationAlert,
          updateAlertAPI: updateNotificationAlert,
          afterSaveAction: async (savedFqn: string) => {
            if (isEditMode) {
              onNavigate({
                type: 'detail',
                fqn: savedFqn,
                name: data.displayName ?? '',
              });
            } else {
              onNavigate({ type: 'list' });
              await getResourceLimit('eventsubscription', true, true);
            }
          },
          setInlineAlertDetails,
        });
      } finally {
        setSaving(false);
      }
    },
    [
      fqn,
      initialData,
      currentUser,
      isEditMode,
      onNavigate,
      getResourceLimit,
      setInlineAlertDetails,
    ]
  );

  if (isLoading || (isEditMode && isUndefined(alert))) {
    return <Loader />;
  }

  if (isSystemProvider) {
    return (
      <Box className="tw:flex tw:items-center tw:justify-center tw:h-full tw:p-6">
        <Typography
          className="tw:text-secondary tw:max-w-md tw:text-center"
          size="text-sm">
          {t('message.system-alert-edit-message')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="tw:flex tw:flex-col tw:h-full" direction="col">
      <Box className="tw:flex-1 tw:overflow-y-auto tw:px-8" direction="col">
        <Box className="tw:w-1/2" direction="col">
        <AlertAiForm
          alert={alert}
          containerEntities={resourceDescriptor?.containerEntities}
          fieldDocDisplay="popover"
          filterResources={
            filterResources as Parameters<typeof AlertAiForm>[0]['filterResources']
          }
          formId={ALERT_AI_FORM_MODAL_ID}
          inlineAlert={
            inlineAlertDetails
              ? {
                  heading: inlineAlertDetails.heading,
                  description: inlineAlertDetails.description,
                  type: inlineAlertDetails.type,
                  onClose: inlineAlertDetails.onClose,
                }
              : undefined
          }
          mode={isEditMode ? 'edit' : 'add'}
          shouldShowActionsSection={false}
          shouldShowFiltersSection={shouldShowFiltersSection}
          shouldShowTemplateSection={!isEmpty(extraFormWidgets)}
          showHint={showHint}
          supportedFilters={
            resourceDescriptor?.supportedFilters as Parameters<
              typeof AlertAiForm
            >[0]['supportedFilters']
          }
          templates={templates}
          value={formData}
          onChange={setFormData}
          onSubmit={handleSave}
        />
        </Box>
      </Box>

      <Box
        className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-primary tw:px-6 tw:py-4"
        direction="row"
        gap={3}
        justify="end">
        <Button
          color="tertiary"
          data-testid="cancel-btn"
          onPress={() => onNavigate({ type: 'list' })}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="save-btn"
          form={ALERT_AI_FORM_MODAL_ID}
          isLoading={saving}
          type="submit">
          {t('label.save')}
        </Button>
      </Box>
    </Box>
  );
};

export default NotificationAlertForm;

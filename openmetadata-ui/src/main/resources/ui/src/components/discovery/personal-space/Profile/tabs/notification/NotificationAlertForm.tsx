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
import { isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_READ_TIMEOUT } from '../../../../../../constants/Alerts.constants';
import { PAGE_SIZE_LARGE } from '../../../../../../constants/constants';
import { useLimitStore } from '../../../../../../context/LimitsProvider/useLimitsStore';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import {
  NotificationTemplate,
  ProviderType as TemplateProviderType,
} from '../../../../../../generated/entity/events/notificationTemplate';
import { AlertType as CapabilitiesAlertType } from '../../../../../../generated/events/api/alertCapabilitiesRequest';
import {
  AlertType,
  EventSubscription,
  ProviderType,
} from '../../../../../../generated/events/eventSubscription';
import { useAlertSelection } from '../../../../../../hooks/useAlertSelection';
import { useApplicationStore } from '../../../../../../hooks/useApplicationStore';
import {
  createNotificationAlert,
  getAlertsFromName,
  updateNotificationAlert,
} from '../../../../../../rest/alertsAPI';
import { getAllNotificationTemplates } from '../../../../../../rest/notificationtemplateAPI';
import {
  shouldShowRuleSection,
  toCapabilitiesInput,
} from '../../../../../../utils/Alerts/AlertSelectionUtil';
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

// One array for "nothing selected", so what depends on the sources does not change every render.
const NO_SOURCES: string[] = [];

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
  resources: (alert as unknown as { filteringRules?: { resources?: string[] } })
    .filteringRules?.resources,
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
  const [alert, setAlert] = useState<ModifiedEventSubscription>();
  const [initialData, setInitialData] = useState<EventSubscription>();
  const [formData, setFormData] =
    useState<ModifiedCreateEventSubscription>(getEmptyFormValues);

  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [templateResourcePermission, setTemplateResourcePermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const hasTemplateSection = useMemo(
    () => Boolean(alertsClassBase.getAlertAiTemplateSection()),
    []
  );

  const isEditMode = Boolean(fqn);

  const sources = formData.resources ?? NO_SOURCES;
  const capabilitiesInput = useMemo(
    () => toCapabilitiesInput(formData.input),
    [formData.input]
  );
  // The server says what the chosen sources support and who they can reach, as in every alert form.
  const selection = useAlertSelection({
    alertType: CapabilitiesAlertType.Notification,
    sources,
    input: capabilitiesInput,
  });

  const { hasFilters } = selection.support;
  const shouldShowFiltersSection = useMemo(
    () => shouldShowRuleSection(sources, hasFilters, formData.input?.filters),
    [sources, hasFilters, formData.input?.filters]
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [alertResponse] = await Promise.allSettled([
        fqn ? getAlertsFromName(fqn) : Promise.resolve(null),
      ]);

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

      if (hasTemplateSection) {
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
  }, [fqn, t, hasTemplateSection, getResourcePermission]);

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
            onNavigate({
              type: 'detail',
              fqn: savedFqn,
              name: data.displayName ?? '',
            });

            if (!isEditMode) {
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

  // The form shows what the server says the sources support, so it waits for its first answer.
  if (isLoading || !selection.ready || (isEditMode && isUndefined(alert))) {
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
        <Box className="tw:max-w-[50%] tw:w-full tw:mx-auto" direction="col">
          <AlertAiForm
            alert={alert}
            fieldDocDisplay="popover"
            fieldDocVariant="muted"
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
            selection={selection}
            shouldShowActionsSection={false}
            shouldShowFiltersSection={shouldShowFiltersSection}
            showHint={showHint}
            templateResourcePermission={templateResourcePermission}
            templates={templates}
            value={formData}
            onChange={setFormData}
            onSubmit={handleSave}
          />
        </Box>
      </Box>

      <Box
        className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-surface tw:px-6 tw:py-4"
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

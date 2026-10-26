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

import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../constants/GlobalSettings.constants';
import { useLimitStore } from '../../../context/LimitsProvider/useLimitsStore';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  AlertType,
  EventSubscription,
} from '../../../generated/events/eventSubscription';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useFqn } from '../../../hooks/useFqn';
import {
  createNotificationAlert,
  getAlertsFromName,
  updateNotificationAlert,
} from '../../../rest/alertsAPI';
import {
  createObservabilityAlert,
  getObservabilityAlertByFQN,
  updateObservabilityAlert,
} from '../../../rest/observabilityAPI';
import alertsClassBase from '../../../utils/AlertsClassBase';
import observabilityRouterClassBase from '../../../utils/ObservabilityRouterClassBase';
import {
  getNotificationAlertDetailsPath,
  getSettingPath,
} from '../../../utils/RouterUtils';
import {
  ModifiedCreateEventSubscription,
  ModifiedEventSubscription,
  UseAlertFormDataOptions,
  UseAlertFormDataReturn,
} from '../AddObservabilityPage.interface';
import { useAlertResources } from './useAlertResources';
import { useObservabilityAlertTemplates } from './useObservabilityAlertTemplates';

/**
 * Alert form state, what the chosen sources support, templates and save for a caller that owns
 * the form values, so it needs no antd form. The caller passes the chosen sources and the choices
 * so far.
 */
export function useAlertFormData({
  afterSaveAction,
  alertType,
  fqn: fqnProp,
  onCancel,
  sources,
  input,
}: UseAlertFormDataOptions): UseAlertFormDataReturn {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { getResourcePermission } = usePermissionProvider();
  const { fqn: routeFqn } = useFqn();
  const fqn = fqnProp ?? routeFqn;
  const { setInlineAlertDetails, inlineAlertDetails, currentUser } =
    useApplicationStore();
  const { getResourceLimit } = useLimitStore();

  const [alert, setAlert] = useState<ModifiedEventSubscription>();
  const [alertError, setAlertError] = useState<AxiosError>();
  const [initialData, setInitialData] = useState<EventSubscription>();
  const [loadingState, setLoadingState] = useState<
    UseAlertFormDataReturn['loadingState']
  >({
    alerts: false,
    templates: false,
  });
  const [saving, setSaving] = useState(false);

  const isEditMode = useMemo(() => !isEmpty(fqn), [fqn]);
  const isNotification = alertType === AlertType.Notification;
  const extraFormWidgets = useMemo(
    () => alertsClassBase.getAddAlertFormExtraWidgets(),
    []
  );
  const extraFormButtons = useMemo(
    () => alertsClassBase.getAddAlertFormExtraButtons(),
    []
  );
  const alertResources = useAlertResources(alertType, sources, input);
  const alertTemplates = useObservabilityAlertTemplates({
    extraFormWidgets,
    getResourcePermission,
  });

  const fetchAlert = useCallback(async () => {
    try {
      setLoadingState((state) => ({ ...state, alerts: true }));
      setAlertError(undefined);

      const observabilityAlert = isNotification
        ? await getAlertsFromName(fqn)
        : await getObservabilityAlertByFQN(fqn);
      const modifiedAlertData =
        alertsClassBase.getModifiedAlertDataForForm(observabilityAlert);

      setInitialData(observabilityAlert);
      setAlert(modifiedAlertData);
    } catch (error) {
      setAlertError(error as AxiosError);
    } finally {
      setLoadingState((state) => ({ ...state, alerts: false }));
    }
  }, [fqn, isNotification]);

  useEffect(() => {
    if (!fqn) {
      return;
    }
    fetchAlert();
  }, [fetchAlert, fqn]);

  const breadcrumb = useMemo(
    () => [
      ...(isNotification
        ? [
            { name: t('label.setting-plural'), url: ROUTES.SETTINGS },
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
          ]
        : [
            { name: t('label.observability'), url: '' },
            {
              name: t('label.alert-plural'),
              url: observabilityRouterClassBase.getObservabilityAlertsListPath(),
            },
          ]),
      {
        name: fqn
          ? t('label.edit-entity', { entity: t('label.alert') })
          : t('label.create-entity', { entity: t('label.alert') }),
        url: '',
      },
    ],
    [fqn, isNotification, t]
  );

  const handleSave = useCallback(
    async (data: ModifiedCreateEventSubscription) => {
      try {
        setSaving(true);

        await alertsClassBase.handleAlertSave({
          data,
          fqn,
          initialData,
          currentUser,
          createAlertAPI: isNotification
            ? createNotificationAlert
            : createObservabilityAlert,
          updateAlertAPI: isNotification
            ? updateNotificationAlert
            : updateObservabilityAlert,
          afterSaveAction: async (savedFqn: string) => {
            if (!isEditMode) {
              await getResourceLimit('eventsubscription', true, true);
            }

            if (afterSaveAction) {
              await afterSaveAction(savedFqn);

              return;
            }

            navigate(
              isNotification
                ? getNotificationAlertDetailsPath(savedFqn)
                : observabilityRouterClassBase.getObservabilityAlertDetailsPath(
                    savedFqn
                  )
            );
          },
          setInlineAlertDetails,
        });
      } catch {
        // Error handling done in "handleAlertSave"
      } finally {
        setSaving(false);
      }
    },
    [
      afterSaveAction,
      currentUser,
      fqn,
      getResourceLimit,
      initialData,
      isEditMode,
      isNotification,
      navigate,
      setInlineAlertDetails,
    ]
  );

  const isLoading = useMemo(
    () =>
      Object.values(loadingState).some(Boolean) ||
      alertResources.loading ||
      alertTemplates.loading,
    [alertResources.loading, alertTemplates.loading, loadingState]
  );

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();

      return;
    }

    navigate(-1);
  }, [navigate, onCancel]);

  return {
    alert,
    alertError,
    breadcrumb,
    extraFormButtons,
    extraFormWidgets,
    fetchAlert,
    handleCancel,
    handleSave,
    inlineAlertDetails,
    isEditMode,
    isLoading,
    loadingState: {
      ...loadingState,
      templates: alertTemplates.loading,
    },
    saving,
    selection: alertResources.selection,
    shouldShowActionsSection: alertResources.shouldShowActionsSection,
    shouldShowFiltersSection: alertResources.shouldShowFiltersSection,
    templateResourcePermission: alertTemplates.templateResourcePermission,
    templates: alertTemplates.templates,
  };
}

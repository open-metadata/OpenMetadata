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

import { useForm } from 'antd/lib/form/Form';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLimitStore } from '../../../context/LimitsProvider/useLimitsStore';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { EventSubscription } from '../../../generated/events/eventSubscription';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useFqn } from '../../../hooks/useFqn';
import {
  createObservabilityAlert,
  getObservabilityAlertByFQN,
  updateObservabilityAlert,
} from '../../../rest/observabilityAPI';
import alertsClassBase from '../../../utils/AlertsClassBase';
import observabilityRouterClassBase from '../../../utils/ObservabilityRouterClassBase';
import { AddAlertPageLoadingState } from '../../AddNotificationPage/AddNotificationPage.interface';
import {
  ModifiedCreateEventSubscription,
  ModifiedEventSubscription,
  UseObservabilityAlertFormOptions,
  UseObservabilityAlertFormReturn,
} from '../AddObservabilityPage.interface';
import { useObservabilityAlertResources } from './useObservabilityAlertResources';
import { useObservabilityAlertTemplates } from './useObservabilityAlertTemplates';

export function useObservabilityAlertForm({
  afterSaveAction,
  form: providedForm,
  fqn: fqnProp,
  onCancel,
}: UseObservabilityAlertFormOptions = {}): UseObservabilityAlertFormReturn {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [internalForm] = useForm<ModifiedCreateEventSubscription>();
  const form = providedForm ?? internalForm;
  const { getResourcePermission } = usePermissionProvider();
  const { fqn: routeFqn } = useFqn();
  const fqn = fqnProp ?? routeFqn;
  const { setInlineAlertDetails, inlineAlertDetails, currentUser } =
    useApplicationStore();
  const { getResourceLimit } = useLimitStore();

  const [alert, setAlert] = useState<ModifiedEventSubscription>();
  const [initialData, setInitialData] = useState<EventSubscription>();
  const [loadingState, setLoadingState] = useState<AddAlertPageLoadingState>({
    alerts: false,
    functions: false,
    templates: false,
  });
  const [saving, setSaving] = useState(false);

  const isEditMode = useMemo(() => !isEmpty(fqn), [fqn]);
  const extraFormWidgets = useMemo(
    () => alertsClassBase.getAddAlertFormExtraWidgets(),
    []
  );
  const extraFormButtons = useMemo(
    () => alertsClassBase.getAddAlertFormExtraButtons(),
    []
  );
  const alertResources = useObservabilityAlertResources(form);
  const alertTemplates = useObservabilityAlertTemplates({
    extraFormWidgets,
    getResourcePermission,
  });

  const fetchAlert = useCallback(async () => {
    try {
      setLoadingState((state) => ({ ...state, alerts: true }));

      const observabilityAlert = await getObservabilityAlertByFQN(fqn);
      const modifiedAlertData =
        alertsClassBase.getModifiedAlertDataForForm(observabilityAlert);

      setInitialData(observabilityAlert);
      setAlert(modifiedAlertData);
    } catch {
      // Error handling
    } finally {
      setLoadingState((state) => ({ ...state, alerts: false }));
    }
  }, [fqn]);

  useEffect(() => {
    if (!fqn) {
      return;
    }
    fetchAlert();
  }, [fetchAlert, fqn]);

  const breadcrumb = useMemo(
    () => [
      {
        name: t('label.observability'),
        url: '',
      },
      {
        name: t('label.alert-plural'),
        url: observabilityRouterClassBase.getObservabilityAlertsListPath(),
      },
      {
        name: fqn
          ? t('label.edit-entity', { entity: t('label.alert') })
          : t('label.create-entity', { entity: t('label.alert') }),
        url: '',
      },
    ],
    [fqn, t]
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
          createAlertAPI: createObservabilityAlert,
          updateAlertAPI: updateObservabilityAlert,
          afterSaveAction: async (savedFqn: string) => {
            if (afterSaveAction) {
              await afterSaveAction(savedFqn);

              return;
            }

            if (!isEditMode) {
              await getResourceLimit('eventsubscription', true, true);
            }

            navigate(
              observabilityRouterClassBase.getObservabilityAlertDetailsPath(
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
      navigate,
      setInlineAlertDetails,
    ]
  );

  const isLoading = useMemo(
    () =>
      Object.values(loadingState).some((val) => val) ||
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
    breadcrumb,
    containerEntities: alertResources.containerEntities,
    extraFormButtons,
    extraFormWidgets,
    filterResources: alertResources.filterResources,
    form,
    handleCancel,
    handleSave,
    inlineAlertDetails,
    isEditMode,
    isLoading,
    loadingState: {
      ...loadingState,
      functions: alertResources.loading,
      templates: alertTemplates.loading,
    },
    saving,
    shouldShowActionsSection: alertResources.shouldShowActionsSection,
    shouldShowFiltersSection: alertResources.shouldShowFiltersSection,
    supportedFilters: alertResources.supportedFilters,
    supportedTriggers: alertResources.supportedTriggers,
    templateResourcePermission: alertTemplates.templateResourcePermission,
    templates: alertTemplates.templates,
  };
}

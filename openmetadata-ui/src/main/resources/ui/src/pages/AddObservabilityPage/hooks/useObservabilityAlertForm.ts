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

import { Form } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { useLimitStore } from '../../../context/LimitsProvider/useLimitsStore';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import {
  NotificationTemplate,
  ProviderType,
} from '../../../generated/entity/events/notificationTemplate';
import { Operation } from '../../../generated/entity/policies/policy';
import { CreateEventSubscription } from '../../../generated/events/api/createEventSubscription';
import { EventSubscription } from '../../../generated/events/eventSubscription';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useFqn } from '../../../hooks/useFqn';
import { getAllNotificationTemplates } from '../../../rest/notificationtemplateAPI';
import {
  createObservabilityAlert,
  getObservabilityAlertByFQN,
  getResourceFunctions,
  updateObservabilityAlert,
} from '../../../rest/observabilityAPI';
import alertsClassBase from '../../../utils/AlertsClassBase';
import observabilityRouterClassBase from '../../../utils/ObservabilityRouterClassBase';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedViewPermission,
} from '../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AddAlertPageLoadingState } from '../../AddNotificationPage/AddNotificationPage.interface';
import {
  ModifiedCreateEventSubscription,
  ModifiedEventSubscription,
  ObservabilityFilterResourceDescriptor,
  UseObservabilityAlertFormReturn,
} from '../AddObservabilityPage.interface';

export function useObservabilityAlertForm(): UseObservabilityAlertFormReturn {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form] = useForm<ModifiedCreateEventSubscription>();
  const { getResourcePermission } = usePermissionProvider();
  const { fqn } = useFqn();
  const { setInlineAlertDetails, inlineAlertDetails, currentUser } =
    useApplicationStore();
  const { getResourceLimit } = useLimitStore();

  const [filterResources, setFilterResources] = useState<
    ObservabilityFilterResourceDescriptor[]
  >([]);
  const [alert, setAlert] = useState<ModifiedEventSubscription>();
  const [initialData, setInitialData] = useState<EventSubscription>();
  const [loadingState, setLoadingState] = useState<AddAlertPageLoadingState>({
    alerts: false,
    functions: false,
    templates: false,
  });
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [templateResourcePermission, setTemplateResourcePermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const isEditMode = useMemo(() => !isEmpty(fqn), [fqn]);

  const fetchAlert = async () => {
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
  };

  const fetchFunctions = async () => {
    try {
      setLoadingState((state) => ({ ...state, functions: true }));
      const filterResources = await getResourceFunctions();

      setFilterResources(
        filterResources.data as unknown as ObservabilityFilterResourceDescriptor[]
      );
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
          afterSaveAction: async (fqn: string) => {
            !fqn && (await getResourceLimit('eventsubscription', true, true));
            navigate(
              observabilityRouterClassBase.getObservabilityAlertDetailsPath(fqn)
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
      currentUser,
      fqn,
      getResourceLimit,
      initialData,
      navigate,
      setInlineAlertDetails,
    ]
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

  const containerEntities = useMemo<
    UseObservabilityAlertFormReturn['containerEntities']
  >(
    () =>
      filterResources.find((resource) => resource.name === selectedTrigger)
        ?.containerEntities,
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
  }, [getResourcePermission, t]);

  useEffect(() => {
    if (!isEmpty(extraFormWidgets)) {
      fetchTemplates();
    }
  }, [extraFormWidgets]);

  const isLoading = useMemo(
    () => Object.values(loadingState).some((val) => val),
    [loadingState]
  );

  const handleCancel = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return {
    alert,
    breadcrumb,
    containerEntities,
    extraFormButtons,
    extraFormWidgets,
    filterResources,
    form,
    handleCancel,
    handleSave,
    inlineAlertDetails,
    isEditMode,
    isLoading,
    loadingState,
    saving,
    shouldShowActionsSection,
    shouldShowFiltersSection,
    supportedFilters,
    supportedTriggers,
    templateResourcePermission,
    templates,
  };
}

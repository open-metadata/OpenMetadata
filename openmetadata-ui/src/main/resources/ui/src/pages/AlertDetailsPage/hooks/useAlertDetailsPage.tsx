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
import { compare } from 'fast-json-patch';
import { isUndefined, omitBy } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AlertConfigDetails from '../../../components/Alerts/AlertDetails/AlertConfigDetails/AlertConfigDetails';
import AlertDiagnosticInfoTab from '../../../components/Alerts/AlertDetails/AlertDiagnosticInfo/AlertDiagnosticInfoTab';
import AlertRecentEventsTab from '../../../components/Alerts/AlertDetails/AlertRecentEventsTab/AlertRecentEventsTab';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ROUTES } from '../../../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../constants/GlobalSettings.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { AlertDetailTabs } from '../../../enums/Alerts.enum';
import { EntityType } from '../../../enums/entity.enum';
import { EventsRecord } from '../../../generated/events/api/eventsRecord';
import {
  EntityReference,
  EventSubscription,
} from '../../../generated/events/eventSubscription';
import { useFqn } from '../../../hooks/useFqn';
import { updateNotificationAlert } from '../../../rest/alertsAPI';
import {
  getAlertEventsDiagnosticsInfo,
  getObservabilityAlertByFQN,
  syncOffset,
  updateObservabilityAlert,
} from '../../../rest/observabilityAPI';
import { getAlertExtraInfo } from '../../../utils/Alerts/AlertsUtil';
import { getEntityName } from '../../../utils/EntityNameUtils';
import observabilityRouterClassBase from '../../../utils/ObservabilityRouterClassBase';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import {
  getNotificationAlertDetailsPath,
  getNotificationAlertsEditPath,
  getSettingPath,
} from '../../../utils/RouterUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import {
  AlertDetailsPageProps,
  UseAlertDetailsPageReturn,
} from '../AlertDetailsPage.interface';

export function useAlertDetailsPage({
  isNotificationAlert,
}: Readonly<AlertDetailsPageProps>): UseAlertDetailsPageReturn {
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { tab } = useRequiredParams<{ tab: AlertDetailTabs }>();
  const { fqn } = useFqn();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [alertDetails, setAlertDetails] = useState<EventSubscription>();
  const [alertEventCounts, setAlertEventCounts] = useState<EventsRecord>();
  const [loadingCount, setLoadingCount] = useState(0);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [alertEventCountsLoading, setAlertEventCountsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [alertPermission, setAlertPermission] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [isSyncing, setIsSyncing] = useState(false);

  const {
    viewPermission,
    editOwnersPermission,
    editDescriptionPermission,
    editPermission,
    deletePermission,
  } = useMemo(
    () => ({
      viewPermission: alertPermission.ViewAll || alertPermission.ViewBasic,
      editPermission: alertPermission.EditAll,
      editOwnersPermission:
        alertPermission.EditAll || alertPermission.EditOwners,
      editDescriptionPermission:
        alertPermission.EditAll || alertPermission.EditDescription,
      deletePermission: alertPermission.Delete,
    }),
    [alertPermission]
  );

  const fetchResourcePermission = useCallback(async () => {
    try {
      setLoadingCount((count) => count + 1);
      if (fqn) {
        const searchIndexPermission = await getEntityPermissionByFqn(
          ResourceEntity.EVENT_SUBSCRIPTION,
          fqn
        );

        setAlertPermission(searchIndexPermission);
      }
    } finally {
      setLoadingCount((count) => count - 1);
    }
  }, [fqn, getEntityPermissionByFqn]);

  const alertIcon = useMemo(
    () => searchClassBase.getEntityIcon(EntityType.ALERT, 'h-9'),
    []
  );

  const fetchAlertDetails = async () => {
    try {
      setLoadingCount((count) => count + 1);
      const observabilityAlert = await getObservabilityAlertByFQN(fqn, {
        fields: 'owners',
      });

      setAlertDetails(observabilityAlert);
    } catch {
      // Error handling
    } finally {
      setLoadingCount((count) => count - 1);
    }
  };

  const fetchAlertEventDiagnosticCounts = async () => {
    try {
      setAlertEventCountsLoading(true);
      const alertCounts = await getAlertEventsDiagnosticsInfo({
        fqn,
        listCountOnly: true,
      });

      setAlertEventCounts(alertCounts);
    } catch {
      // Error handling
    } finally {
      setAlertEventCountsLoading(false);
    }
  };

  const breadcrumb = useMemo(
    () =>
      isNotificationAlert
        ? [
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
              name: getEntityName(alertDetails),
              url: '',
            },
          ]
        : [
            {
              name: t('label.observability'),
              url: '',
            },
            {
              name: t('label.alert-plural'),
              url: observabilityRouterClassBase.getObservabilityAlertsListPath(),
            },
            {
              name: getEntityName(alertDetails),
              url: '',
            },
          ],
    [alertDetails, isNotificationAlert, t]
  );

  const handleAlertDelete = useCallback(async () => {
    isNotificationAlert
      ? navigate(ROUTES.NOTIFICATION_ALERT_LIST)
      : navigate(observabilityRouterClassBase.getObservabilityAlertsListPath());
  }, [isNotificationAlert, navigate]);

  const handleAlertEdit = useCallback(async () => {
    navigate(
      isNotificationAlert
        ? getNotificationAlertsEditPath(fqn)
        : observabilityRouterClassBase.getObservabilityAlertsEditPath(fqn)
    );
  }, [fqn, isNotificationAlert, navigate]);

  const handleAlertSync = useCallback(async () => {
    try {
      setIsSyncing(true);
      await syncOffset(fqn);
      showSuccessToast(t('message.alert-synced-successfully'));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSyncing(false);
    }
  }, [fqn, t]);

  const onOwnerUpdate = useCallback(
    async (owners?: EntityReference[]) => {
      try {
        setOwnerLoading(true);
        const jsonPatch = compare(omitBy(alertDetails, isUndefined), {
          ...alertDetails,
          owners,
        });

        const updatedAlert = await (isNotificationAlert
          ? updateNotificationAlert(alertDetails?.id ?? '', jsonPatch)
          : updateObservabilityAlert(alertDetails?.id ?? '', jsonPatch));

        setAlertDetails(updatedAlert);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setOwnerLoading(false);
      }
    },
    [alertDetails, isNotificationAlert]
  );

  const onDescriptionUpdate = useCallback(
    async (description: string) => {
      try {
        const jsonPatch = compare(omitBy(alertDetails, isUndefined), {
          ...alertDetails,
          description,
        });

        const updatedAlert = await (isNotificationAlert
          ? updateNotificationAlert(alertDetails?.id ?? '', jsonPatch)
          : updateObservabilityAlert(alertDetails?.id ?? '', jsonPatch));

        setAlertDetails(updatedAlert);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [alertDetails, isNotificationAlert]
  );

  const tabItems = useMemo(
    () => [
      {
        label: t('label.configuration'),
        key: AlertDetailTabs.CONFIGURATION,
        children: isUndefined(alertDetails) ? (
          <ErrorPlaceHolder className="m-0" />
        ) : (
          <AlertConfigDetails
            alertDetails={alertDetails}
            isNotificationAlert={isNotificationAlert}
          />
        ),
      },
      {
        label: t('label.recent-event-plural'),
        key: AlertDetailTabs.RECENT_EVENTS,
        children: isUndefined(alertDetails) ? null : (
          <AlertRecentEventsTab alertDetails={alertDetails} />
        ),
      },
      {
        label: t('label.diagnostic-info'),
        key: AlertDetailTabs.DIAGNOSTIC_INFO,
        children: <AlertDiagnosticInfoTab />,
      },
    ],
    [alertDetails, isNotificationAlert, t]
  );

  const handleTabChange = useCallback(
    (activeKey: string) => {
      navigate(
        isNotificationAlert
          ? getNotificationAlertDetailsPath(fqn, activeKey)
          : observabilityRouterClassBase.getObservabilityAlertDetailsPath(
              fqn,
              activeKey
            ),
        { replace: true }
      );
    },
    [fqn, isNotificationAlert, navigate]
  );

  const hideDeleteModal = useCallback(() => {
    setShowDeleteModal(false);
  }, []);

  useEffect(() => {
    fetchResourcePermission();
  }, []);

  useEffect(() => {
    if (viewPermission) {
      fetchAlertDetails();
      fetchAlertEventDiagnosticCounts();
    }
  }, [viewPermission]);

  const extraInfo = useMemo(
    () => getAlertExtraInfo(alertEventCountsLoading, alertEventCounts),
    [alertEventCounts, alertEventCountsLoading]
  );

  return {
    alertDetails,
    alertIcon,
    breadcrumb,
    deletePermission,
    editDescriptionPermission,
    editOwnersPermission,
    editPermission,
    extraInfo,
    handleAlertDelete,
    handleAlertEdit,
    handleAlertSync,
    handleTabChange,
    hideDeleteModal,
    isSyncing,
    loadingCount,
    onDescriptionUpdate,
    onOwnerUpdate,
    ownerLoading,
    setShowDeleteModal,
    showDeleteModal,
    tab,
    tabItems,
    viewPermission,
  };
}

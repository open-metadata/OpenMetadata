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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PagingHandlerParams } from '../../../components/common/NextPrevious/NextPrevious.interface';
import { useLimitStore } from '../../../context/LimitsProvider/useLimitsStore';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import {
  AlertType,
  EventSubscription,
  ProviderType,
} from '../../../generated/events/eventSubscription';
import { Paging } from '../../../generated/type/paging';
import { usePaging } from '../../../hooks/paging/usePaging';
import { getAllAlerts } from '../../../rest/alertsAPI';
import observabilityRouterClassBase from '../../../utils/ObservabilityRouterClassBase';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  AlertTableColumn,
  ALERT_TABLE_COLUMN_IDS,
} from '../ObservabilityAlertsPage.constants';
import {
  AlertPermission,
  UseObservabilityAlertsReturn,
} from '../ObservabilityAlertsPage.interface';

export function useObservabilityAlerts(): UseObservabilityAlertsReturn {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadingCount, setLoadingCount] = useState(0);
  const [alerts, setAlerts] = useState<EventSubscription[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<EventSubscription>();
  const [alertPermissions, setAlertPermissions] = useState<AlertPermission[]>();
  const [alertResourcePermission, setAlertResourcePermission] =
    useState<OperationPermission>();
  const {
    pageSize,
    currentPage,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    showPagination,
    paging,
    pagingCursor,
  } = usePaging();
  const { getResourceLimit } = useLimitStore();
  const { getEntityPermissionByFqn, getResourcePermission } =
    usePermissionProvider();

  const fetchAlertResourcePermission = useCallback(async () => {
    try {
      setLoadingCount((count) => count + 1);
      const permission = await getResourcePermission(
        ResourceEntity.EVENT_SUBSCRIPTION
      );

      setAlertResourcePermission(permission);
    } catch {
      // Error
    } finally {
      setLoadingCount((count) => count - 1);
    }
  }, [getResourcePermission]);

  const fetchAlertPermissionByFqn = useCallback(
    async (alertDetails: EventSubscription) => {
      const permission = await getEntityPermissionByFqn(
        ResourceEntity.EVENT_SUBSCRIPTION,
        alertDetails.fullyQualifiedName ?? ''
      );

      return {
        id: alertDetails.id,
        edit: permission.EditAll,
        delete: permission.Delete,
      };
    },
    [getEntityPermissionByFqn]
  );

  const fetchAllAlertsPermission = useCallback(
    async (alerts: EventSubscription[]) => {
      try {
        setLoadingCount((count) => count + 1);
        const response = alerts.map((alert) =>
          fetchAlertPermissionByFqn(alert)
        );

        setAlertPermissions(await Promise.all(response));
      } catch {
        // Error
      } finally {
        setLoadingCount((count) => count - 1);
      }
    },
    [fetchAlertPermissionByFqn]
  );

  const fetchAlerts = useCallback(
    async (params?: Partial<Paging>) => {
      setLoading(true);
      try {
        const { data, paging } = await getAllAlerts({
          after: params?.after,
          before: params?.before,
          limit: pageSize,
          alertType: AlertType.Observability,
        });
        const alertsList = data.filter(
          (d) => d.provider !== ProviderType.System
        );

        setAlerts(alertsList);
        handlePagingChange(paging);
        fetchAllAlertsPermission(alertsList);
      } catch {
        showErrorToast(
          t('server.entity-fetch-error', { entity: t('label.alert-plural') })
        );
      } finally {
        setLoading(false);
      }
    },
    [fetchAllAlertsPermission, handlePagingChange, pageSize, t]
  );

  useEffect(() => {
    fetchAlertResourcePermission();
  }, []);

  useEffect(() => {
    const { cursorType, cursorValue } = pagingCursor ?? {};

    if (cursorType && cursorValue) {
      fetchAlerts({ [cursorType]: cursorValue });
    } else {
      fetchAlerts();
    }
  }, [pageSize, pagingCursor]);

  const handleAlertDelete = useCallback(async () => {
    try {
      setSelectedAlert(undefined);
      await getResourceLimit('eventsubscription', true, true);
      fetchAlerts();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [fetchAlerts, getResourceLimit]);

  const onPageChange = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (cursorType) {
        handlePageChange(
          currentPage,
          { cursorType, cursorValue: paging[cursorType] },
          pageSize
        );
      }
    },
    [handlePageChange, paging, pageSize]
  );

  const columnList = useMemo<AlertTableColumn[]>(
    () => [
      {
        id: ALERT_TABLE_COLUMN_IDS.NAME,
        name: t('label.name'),
      },
      {
        id: ALERT_TABLE_COLUMN_IDS.TRIGGER,
        name: t('label.trigger'),
      },
      {
        id: ALERT_TABLE_COLUMN_IDS.DESCRIPTION,
        name: t('label.description'),
      },
      {
        id: ALERT_TABLE_COLUMN_IDS.ACTIONS,
        name: t('label.action-plural'),
      },
    ],
    [t]
  );

  const handleAddAlert = useCallback(() => {
    navigate(observabilityRouterClassBase.getAddObservabilityAlertsPath());
  }, [navigate]);

  const handleSelectAlert = useCallback((alert?: EventSubscription) => {
    setSelectedAlert(alert);
  }, []);

  return {
    alertPermissions,
    alertResourcePermission,
    alerts,
    columnList,
    currentPage,
    handleAddAlert,
    handleAlertDelete,
    handlePageSizeChange,
    handleSelectAlert,
    loading,
    loadingCount,
    onPageChange,
    paging,
    pageSize,
    selectedAlert,
    showPagination,
  };
}

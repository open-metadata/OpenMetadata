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

import { Button } from '@openmetadata/ui-core-components';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import DeleteModal from '../../../components/common/DeleteModal/DeleteModal';
import HeaderBreadcrumb from '../../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import HeaderShell from '../../../components/common/HeaderShell/HeaderShell.component';
import Loader from '../../../components/common/Loader/Loader';
import { LearningIcon } from '../../../components/Learning/LearningIcon/LearningIcon.component';
import { LEARNING_PAGE_IDS } from '../../../constants/Learning.constants';
import { EventSubscription } from '../../../generated/events/eventSubscription';
import { useObservabilityAlerts } from '../../../pages/ObservabilityAlertsPage/hooks/useObservabilityAlerts';
import { deleteObservabilityAlert } from '../../../rest/observabilityAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { OBSERVABILITY_ALERT_COUNT_QUERY_KEY } from '../observability.constants';
import { getObservabilityRootBreadcrumb } from '../observabilityBreadcrumb.utils';
import ObservabilityPageShell from '../ObservabilityPageShell/ObservabilityPageShell';
import AlertEditModal from './AlertEditModal.component';
import { getAlertsObservabilityDetailsPath } from './alertUtils';
import ObservabilityAlertsAiTable from './ObservabilityAlertsAiTable.component';
import { invalidateQueriesWithoutInitialRace } from './queryCacheUtils';

const AlertsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<EventSubscription>();
  const isFirstRender = useRef(true);

  const handleAddAlert = useCallback(() => {
    setEditingAlert(undefined);
    setIsAddModalOpen(true);
  }, []);

  const handleAddModalSaved = useCallback(
    async (savedFqn?: string) => {
      setIsAddModalOpen(false);
      // The sidebar count is cached independently from the table data, so an
      // alert creation must invalidate that query before navigating away.
      await invalidateQueriesWithoutInitialRace(queryClient, {
        queryKey: OBSERVABILITY_ALERT_COUNT_QUERY_KEY,
      });

      if (savedFqn) {
        navigate(getAlertsObservabilityDetailsPath(savedFqn));
      }
    },
    [navigate, queryClient]
  );

  const handleEditAlert = useCallback((alert: EventSubscription) => {
    setIsAddModalOpen(false);
    setEditingAlert(alert);
  }, []);

  const alertsState = useObservabilityAlerts({
    getAlertDetailsPath: getAlertsObservabilityDetailsPath,
    onAddAlert: handleAddAlert,
  });

  const {
    alertPermissions,
    alertResourcePermission,
    hasResourcePermissionError,
    refetchResourcePermission,
    alerts,
    columnList,
    currentPage,
    fetchAlerts,
    getAlertDetailsPath,
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
  } = alertsState;

  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;

      return;
    }
    fetchAlerts?.();
  }, [fetchAlerts, location.key]);
  const hideDeleteModal = useCallback(() => {
    handleSelectAlert(undefined);
  }, [handleSelectAlert]);

  const handleConfirmDelete = useCallback(async () => {
    if (!selectedAlert?.id) {
      return;
    }

    const alertName = getEntityName(selectedAlert);
    try {
      setIsDeleting(true);
      await deleteObservabilityAlert(selectedAlert.id);
      showSuccessToast(
        t('server.entity-deleted-successfully', { entity: alertName })
      );
      hideDeleteModal();
      await handleAlertDelete();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.delete-entity-error', { entity: alertName })
      );
    } finally {
      setIsDeleting(false);
    }
  }, [selectedAlert, handleAlertDelete, hideDeleteModal, t]);

  const handleEditModalSaved = useCallback(async () => {
    setEditingAlert(undefined);
    await fetchAlerts?.();
  }, [fetchAlerts]);

  const handleAlertModalClose = useCallback(() => {
    if (editingAlert) {
      setEditingAlert(undefined);

      return;
    }

    setIsAddModalOpen(false);
  }, [editingAlert]);

  const isAlertModalOpen = isAddModalOpen || Boolean(editingAlert);
  const alertModalMode = editingAlert ? 'edit' : 'add';

  if (loadingCount > 0) {
    return <Loader />;
  }

  return (
    <>
      <ObservabilityPageShell
        header={
          <HeaderShell
            actions={
              alertResourcePermission?.Create ? (
                <Button
                  color="primary"
                  data-testid="add-alert-button"
                  iconLeading={Plus}
                  size="md"
                  onPress={handleAddAlert}>
                  {t('label.add-entity', { entity: t('label.alert') })}
                </Button>
              ) : null
            }
            badge={
              <LearningIcon
                pageId={LEARNING_PAGE_IDS.ALERTS}
                title={t('label.observability-alert')}
              />
            }
            breadcrumb={
              <HeaderBreadcrumb
                noMargin
                className="tw:text-xs"
                items={[
                  getObservabilityRootBreadcrumb(t),
                  {
                    label: t('label.alert-plural'),
                    ariaLabel: t('label.alert-plural'),
                  },
                ]}
                showHome={false}
              />
            }
            padding="comfortable"
            subtitle={t('message.alerts-description')}
            title={t('label.observability-alert')}
            variant="gradient"
          />
        }
        pageTitle={t('label.observability-alert')}>
        <ObservabilityAlertsAiTable
          alertPermissions={alertPermissions}
          alertResourcePermission={alertResourcePermission}
          alerts={alerts}
          columnList={columnList}
          currentPage={currentPage}
          getAlertDetailsPath={getAlertDetailsPath}
          hasResourcePermissionError={hasResourcePermissionError}
          loading={loading}
          loadingCount={loadingCount}
          pageSize={pageSize}
          paging={paging}
          showPagination={showPagination}
          onAddAlert={handleAddAlert}
          onEditAlert={handleEditAlert}
          onPageChange={onPageChange}
          onPageSizeChange={handlePageSizeChange}
          onRetryPermission={refetchResourcePermission}
          onSelectAlert={handleSelectAlert}
        />
      </ObservabilityPageShell>
      <DeleteModal
        entityTitle={getEntityName(selectedAlert)}
        isDeleting={isDeleting}
        message={t('message.delete-entity-message', {
          entity: getEntityName(selectedAlert),
        })}
        open={Boolean(selectedAlert)}
        onCancel={hideDeleteModal}
        onDelete={handleConfirmDelete}
      />

      {isAlertModalOpen && (
        <AlertEditModal
          fqn={editingAlert?.fullyQualifiedName}
          isOpen={isAlertModalOpen}
          mode={alertModalMode}
          onClose={handleAlertModalClose}
          onSaved={editingAlert ? handleEditModalSaved : handleAddModalSaved}
        />
      )}
    </>
  );
};

export default AlertsPage;

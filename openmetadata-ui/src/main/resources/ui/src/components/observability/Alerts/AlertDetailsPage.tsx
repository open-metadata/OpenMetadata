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

import {
  Box,
  ButtonUtility,
  Owner,
  PageLayout,
  Tabs,
} from '@openmetadata/ui-core-components';
import { useQueryClient } from '@tanstack/react-query';
import { Edit03, RefreshCw04, Trash01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined } from 'lodash';
import { Key, ReactNode, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DeleteModal from '../../../components/common/DeleteModal/DeleteModal';
import DocumentTitle from '../../../components/common/DocumentTitle/DocumentTitle';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import HeaderBreadcrumb from '../../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import Loader from '../../../components/common/Loader/Loader';
import { UserTeamSelectableList } from '../../../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import { AlertDetailTabs } from '../../../enums/Alerts.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import {
  AlertType,
  ProviderType,
} from '../../../generated/events/eventSubscription';
import { useFqn } from '../../../hooks/useFqn';
import { useObservabilityAlertForm } from '../../../pages/AddObservabilityPage/hooks/useObservabilityAlertForm';
import { useAlertDetailsData } from '../../../pages/AlertDetailsPage/hooks/useAlertDetailsData';
import { deleteObservabilityAlert } from '../../../rest/observabilityAPI';
import alertsClassBase from '../../../utils/AlertsClassBase';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { OBSERVABILITY_ALERT_COUNT_QUERY_KEY } from '../observability.constants';
import ObservabilityPageShell from '../ObservabilityPageShell/ObservabilityPageShell';
import AlertAiDiagnosticTab from './AlertAiDiagnosticTab';
import AlertAiEventCounts from './AlertAiEventCounts';
import AlertAiForm from './AlertAiForm.component';
import { getAlertAiResources } from './AlertAiFormFieldsPureUtils';
import AlertAiRecentEventsTab from './AlertAiRecentEventsTab';
import AlertDescriptionCard from './AlertDescriptionCard.component';
import AlertEditModal from './AlertEditModal.component';
import { AlertKind, OBSERVABILITY_ALERT_KIND } from './alertKinds';
import { invalidateQueriesWithoutInitialRace } from './queryCacheUtils';

const ACTION_BUTTON_CLASS_NAME = 'tw:rounded-lg';
const ACTION_ICON_CLASS_NAME = 'tw:h-4 tw:w-4 tw:text-fg-quaternary';

interface AlertDetailsPageProps {
  /** Which alerts this page serves; Settings → Notifications passes its kind. */
  kind?: AlertKind;
}

const AlertDetailsPage = ({
  kind = OBSERVABILITY_ALERT_KIND,
}: AlertDetailsPageProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { fqn } = useFqn();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const alertListPath = kind.listPath;
  const isNotificationAlert = kind.alertType === AlertType.Notification;

  const handleAfterDelete = useCallback(async () => {
    await invalidateQueriesWithoutInitialRace(queryClient, {
      queryKey: OBSERVABILITY_ALERT_COUNT_QUERY_KEY,
    });
    navigate(alertListPath);
  }, [alertListPath, navigate, queryClient]);

  const handleEditAlert = useCallback(() => {
    setIsEditModalOpen(true);
  }, []);

  const handleTabChange = useCallback(
    (tab: Key) => {
      navigate(kind.getDetailsPath(fqn, String(tab)), {
        replace: true,
      });
    },
    [fqn, kind, navigate]
  );

  const detailsState = useAlertDetailsData({
    afterDeleteAction: handleAfterDelete,
    isNotificationAlert,
    onEditAlert: handleEditAlert,
    onTabChange: (tab) => handleTabChange(tab),
  });
  const alertFormState = useObservabilityAlertForm({
    alertType: kind.alertType,
    fqn,
  });

  const {
    alertDetails,
    alertEventCounts,
    alertEventCountsLoading,
    deletePermission,
    editDescriptionPermission,
    editOwnersPermission,
    editPermission,
    fetchAlertDetails,
    handleAlertDelete,
    handleAlertEdit,
    handleAlertSync,
    hideDeleteModal,
    isSyncing,
    loadingCount,
    onDescriptionUpdate,
    onOwnerUpdate,
    ownerLoading,
    setShowDeleteModal,
    showDeleteModal,
    tab,
    viewPermission,
  } = detailsState;

  const alertName = getEntityName(alertDetails);
  // `alertDetails` is undefined for the whole fetch, and `getEntityName`
  // returns '' for it — which would render a bare " | Collate" in the tab.
  const documentTitle = alertName || t('label.alert-detail-plural');
  const alertConfigValue = useMemo(
    () =>
      alertDetails
        ? alertsClassBase.getModifiedAlertDataForForm(alertDetails)
        : undefined,
    [alertDetails]
  );
  const [selectedSource] = alertConfigValue
    ? getAlertAiResources(alertConfigValue)
    : [];
  const selectedAlertResource = useMemo(
    () =>
      alertFormState.filterResources.find(
        (resource) => resource.name === selectedSource
      ),
    [alertFormState.filterResources, selectedSource]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!alertDetails?.id) {
      return;
    }

    try {
      setIsDeleting(true);
      await deleteObservabilityAlert(alertDetails.id);
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
  }, [alertDetails?.id, alertName, handleAlertDelete, hideDeleteModal, t]);

  const handleEditModalSaved = useCallback(async () => {
    setIsEditModalOpen(false);
    await fetchAlertDetails();
  }, [fetchAlertDetails]);

  const tabItems = useMemo(
    () => [
      {
        key: AlertDetailTabs.CONFIGURATION,
        label: t('label.configuration'),
      },
      {
        key: AlertDetailTabs.RECENT_EVENTS,
        label: t('label.recent-event-plural'),
      },
      {
        key: AlertDetailTabs.DIAGNOSTIC_INFO,
        label: t('label.diagnostic-info'),
      },
    ],
    [t]
  );

  const activeTabContent = useMemo<ReactNode>(() => {
    if (tab === AlertDetailTabs.RECENT_EVENTS && alertDetails) {
      return <AlertAiRecentEventsTab alertDetails={alertDetails} />;
    }

    if (tab === AlertDetailTabs.DIAGNOSTIC_INFO) {
      return <AlertAiDiagnosticTab fqn={fqn} />;
    }

    if (tab === AlertDetailTabs.CONFIGURATION && alertConfigValue) {
      return (
        <AlertAiForm
          shouldShowFiltersSection
          alert={alertConfigValue}
          filterResources={alertFormState.filterResources}
          mode="view"
          shouldShowActionsSection={kind.hasTriggers}
          shouldShowTemplateSection={!isEmpty(alertFormState.extraFormWidgets)}
          supportedFilters={selectedAlertResource?.supportedFilters}
          supportedTriggers={selectedAlertResource?.supportedActions}
          templates={alertFormState.templates}
          value={alertConfigValue}
        />
      );
    }

    return null;
  }, [
    alertConfigValue,
    alertDetails,
    fqn,
    alertFormState.extraFormWidgets,
    alertFormState.filterResources,
    alertFormState.templates,
    kind.hasTriggers,
    selectedAlertResource?.supportedActions,
    selectedAlertResource?.supportedFilters,
    tab,
  ]);

  const headerTabs = useMemo(
    () => (
      <Tabs.List
        className="tw:before:hidden"
        data-testid="alert-details-tabs"
        size="sm"
        type="underline">
        {tabItems.map((item) => (
          <Tabs.Item
            id={String(item.key)}
            key={String(item.key)}
            label={item.label}
          />
        ))}
      </Tabs.List>
    ),
    [tabItems]
  );

  const headerFooter = useMemo(
    () => (
      <div className="tw:mt-2">
        <Tabs selectedKey={tab} onSelectionChange={handleTabChange}>
          {headerTabs}
        </Tabs>
      </div>
    ),
    [handleTabChange, headerTabs, tab]
  );

  const headerMetadata = useMemo(
    () => (
      <Box
        align="center"
        className="tw:mt-1.5 tw:flex-wrap tw:text-secondary"
        gap={3}>
        {ownerLoading ? null : (
          <Owner
            hasPermission={editOwnersPermission}
            owners={alertDetails?.owners ?? []}
            selectorContent={
              <UserTeamSelectableList
                hasPermission={Boolean(editOwnersPermission)}
                multiple={{ user: true, team: false }}
                owner={alertDetails?.owners}
                onUpdate={onOwnerUpdate}
              />
            }
          />
        )}
        <AlertAiEventCounts
          counts={alertEventCounts}
          loading={alertEventCountsLoading}
        />
      </Box>
    ),
    [
      alertDetails?.owners,
      alertEventCounts,
      alertEventCountsLoading,
      editOwnersPermission,
      onOwnerUpdate,
      ownerLoading,
    ]
  );

  const breadcrumbItems = useMemo(
    () => [
      ...kind.getRootBreadcrumbs(t),
      {
        label: t('label.alert-plural'),
        ariaLabel: t('label.alert-plural'),
        href: alertListPath,
      },
      {
        label: alertName,
        ariaLabel: alertName,
      },
    ],
    [alertListPath, alertName, kind, t]
  );

  const headerActions = useMemo(
    () => (
      <>
        {editPermission && alertDetails?.provider !== ProviderType.System && (
          <ButtonUtility
            className={ACTION_BUTTON_CLASS_NAME}
            data-testid="edit-button"
            icon={<Edit03 className={ACTION_ICON_CLASS_NAME} />}
            tooltip={t('label.edit-entity', {
              entity: t('label.alert'),
            })}
            onClick={handleAlertEdit}
          />
        )}
        {deletePermission && alertDetails?.provider !== ProviderType.System && (
          <ButtonUtility
            className={ACTION_BUTTON_CLASS_NAME}
            data-testid="delete-button"
            icon={<Trash01 className={ACTION_ICON_CLASS_NAME} />}
            tooltip={t('label.delete-entity', {
              entity: t('label.alert'),
            })}
            onClick={() => setShowDeleteModal(true)}
          />
        )}
        <ButtonUtility
          className={ACTION_BUTTON_CLASS_NAME}
          data-testid="sync-button"
          icon={<RefreshCw04 className={ACTION_ICON_CLASS_NAME} />}
          isDisabled={isSyncing}
          tooltip={t('label.sync-alert-offset', {
            entity: t('label.alert'),
          })}
          onClick={handleAlertSync}
        />
      </>
    ),
    [
      alertDetails?.provider,
      deletePermission,
      editPermission,
      handleAlertEdit,
      handleAlertSync,
      isSyncing,
      setShowDeleteModal,
      t,
    ]
  );

  const guardPlaceholder = useMemo<ReactNode | null>(() => {
    if (!loadingCount && !isUndefined(viewPermission) && !viewPermission) {
      return (
        <ErrorPlaceHolder
          className="border-none"
          permissionValue={t('label.view-entity', {
            entity: t('label.alert-detail-plural'),
          })}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      );
    }

    if (!loadingCount && isUndefined(alertDetails)) {
      return <ErrorPlaceHolder className="m-0" />;
    }

    return null;
  }, [loadingCount, viewPermission, alertDetails, t]);

  if (guardPlaceholder) {
    return guardPlaceholder;
  }

  return (
    <>
      {loadingCount ? (
        <>
          <DocumentTitle title={documentTitle} />
          <Loader />
        </>
      ) : (
        <ObservabilityPageShell
          data-testid="alert-details-ai-page"
          header={
            <PageLayout.PageHeader
              actions={headerActions}
              breadcrumb={
                <HeaderBreadcrumb
                  noMargin
                  className="tw:text-xs"
                  items={breadcrumbItems}
                  showHome={false}
                />
              }
              data-testid="alerts-observability-ai-details-header"
              footer={headerFooter}
              meta={headerMetadata}
              /* The subtitle should mirror the alert identifier from the route,
               * not the backend entity id returned in alertDetails. */
              subtitle={fqn}
              title={alertName}
              variant="gradient"
            />
          }
          pageTitle={alertName}>
          <Box direction="col" gap={4}>
            {tab === AlertDetailTabs.CONFIGURATION && (
              <AlertDescriptionCard
                alertDetails={alertDetails}
                hasEditAccess={editDescriptionPermission}
                onDescriptionUpdate={onDescriptionUpdate}
              />
            )}

            {activeTabContent}
          </Box>
        </ObservabilityPageShell>
      )}

      <DeleteModal
        entityTitle={alertName}
        isDeleting={isDeleting}
        message={t('message.delete-entity-message', { entity: alertName })}
        open={showDeleteModal}
        onCancel={hideDeleteModal}
        onDelete={handleConfirmDelete}
      />

      {isEditModalOpen && (
        <AlertEditModal
          fqn={fqn}
          isOpen={isEditModalOpen}
          kind={kind}
          onClose={() => setIsEditModalOpen(false)}
          onSaved={handleEditModalSaved}
        />
      )}
    </>
  );
};

export default AlertDetailsPage;

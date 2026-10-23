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
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Bell01,
  Edit01,
  RefreshCw04,
  Trash01,
} from '@openmetadata/ui-core-components/icons';
import { useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined } from 'lodash';
import { Key, ReactNode, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DeleteModal from '../../../components/common/DeleteModal/DeleteModal';
import DocumentTitle from '../../../components/common/DocumentTitle/DocumentTitle';
import SomethingWentWrongPlaceholder from '../../../components/common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import HeaderBreadcrumb from '../../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import Loader from '../../../components/common/Loader/Loader';
import { UserTeamSelectableList } from '../../../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import { AlertDetailTabs } from '../../../enums/Alerts.enum';
import { ClientErrors } from '../../../enums/Axios.enum';
import { ProviderType } from '../../../generated/events/eventSubscription';
import { useAlertDetailsData } from '../../../hooks/observability/alerts/useAlertDetailsData';
import { useFqn } from '../../../hooks/useFqn';
import { useAlertFormData } from '../../../pages/AddObservabilityPage/hooks/useAlertFormData';
import { deleteObservabilityAlert } from '../../../rest/observabilityAPI';
import alertsClassBase from '../../../utils/AlertsClassBase';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { invalidateQueriesWithoutInitialRace } from '../../../utils/queryCacheUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import NoDataPlaceholder from '../../common/EmptyPlaceholder/NoDataPlaceholder';
import PermissionPlaceholder from '../../common/EmptyPlaceholder/PermissionPlaceholder';
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

interface AlertDetailsPageProps {
  /** Which alerts this page serves (observability by default). */
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
    onEditAlert: handleEditAlert,
    onTabChange: (tab) => handleTabChange(tab),
  });
  const {
    alertDetails,
    alertDetailsError,
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

  const entityName = getEntityName(alertDetails);
  // Falls back to the route FQN so a failed load still names the alert.
  const alertName = entityName || fqn;
  // `alertDetails` is undefined for the whole fetch, and `getEntityName`
  // returns '' for it — which would render a bare " | Collate" in the tab.
  const documentTitle = entityName || t('label.alert-detail-plural');
  const alertConfigValue = useMemo(
    () =>
      alertDetails
        ? alertsClassBase.getModifiedAlertDataForForm(alertDetails)
        : undefined,
    [alertDetails]
  );
  // The configuration view follows every source the alert watches, as the server answers for them.
  const sources = useMemo(
    () => (alertConfigValue ? getAlertAiResources(alertConfigValue) : []),
    [alertConfigValue]
  );
  const alertFormState = useAlertFormData({
    alertType: kind.alertType,
    fqn,
    sources,
  });
  const { selection } = alertFormState;

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
      // The configuration shows what the server says the sources support, so it waits for it.
      if (!selection.ready) {
        return <Loader />;
      }

      return (
        <AlertAiForm
          shouldShowActionsSection
          shouldShowFiltersSection
          alert={alertConfigValue}
          mode="view"
          selection={selection}
          templateResourcePermission={alertFormState.templateResourcePermission}
          templates={alertFormState.templates}
          templatesLoading={alertFormState.loadingState.templates}
          value={alertConfigValue}
        />
      );
    }

    return null;
  }, [
    alertConfigValue,
    alertDetails,
    fqn,
    alertFormState.loadingState.templates,
    alertFormState.templateResourcePermission,
    alertFormState.templates,
    selection,
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
        className="tw:mt-1.5 tw:text-secondary"
        gap={3}
        wrap="nowrap">
        {!ownerLoading &&
          (!isEmpty(alertDetails?.owners) || editOwnersPermission) && (
            <Box
              align="center"
              className="tw:min-w-0 tw:shrink-0"
              data-testid="alert-owners"
              gap={2}>
              <Typography
                as="span"
                color="secondary"
                size="text-sm"
                weight="medium">
                {t('label.owner-plural')}
              </Typography>
              {!isEmpty(alertDetails?.owners) && (
                <Owner owners={alertDetails?.owners} />
              )}
              {editOwnersPermission && (
                <UserTeamSelectableList
                  hasPermission
                  multiple={{ user: true, team: false }}
                  owner={alertDetails?.owners}
                  onUpdate={onOwnerUpdate}
                />
              )}
            </Box>
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
      t,
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
            color="tertiary"
            data-testid="edit-button"
            icon={Edit01}
            size="lg"
            tooltip={t('label.edit-entity', {
              entity: t('label.alert'),
            })}
            onClick={handleAlertEdit}
          />
        )}
        {deletePermission && alertDetails?.provider !== ProviderType.System && (
          <ButtonUtility
            color="tertiary"
            data-testid="delete-button"
            icon={Trash01}
            size="lg"
            tooltip={t('label.delete-entity', {
              entity: t('label.alert'),
            })}
            onClick={() => setShowDeleteModal(true)}
          />
        )}
        <ButtonUtility
          color="tertiary"
          data-testid="sync-button"
          icon={RefreshCw04}
          isDisabled={isSyncing}
          size="lg"
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
        <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
          <PermissionPlaceholder
            data-testid="permission-error-placeholder"
            permissionValue={t('label.view-entity', {
              entity: t('label.alert-detail-plural'),
            })}
          />
        </div>
      );
    }

    if (!loadingCount && isUndefined(alertDetails)) {
      const status = alertDetailsError?.response?.status;
      let loadErrorPlaceholder = (
        <SomethingWentWrongPlaceholder onReload={fetchAlertDetails} />
      );
      if (status === ClientErrors.NOT_FOUND) {
        loadErrorPlaceholder = (
          <NoDataPlaceholder
            description={t('message.alert-not-found-description')}
            icon={<Bell01 className="tw:text-secondary" />}
            title={t('label.alert-not-found')}
          />
        );
      } else if (status === ClientErrors.FORBIDDEN) {
        loadErrorPlaceholder = (
          <PermissionPlaceholder
            permissionValue={t('label.view-entity', {
              entity: t('label.alert-detail-plural'),
            })}
          />
        );
      }

      return (
        <ObservabilityPageShell
          header={
            <PageLayout.PageHeader
              breadcrumb={
                <HeaderBreadcrumb
                  noMargin
                  className="tw:text-xs"
                  items={breadcrumbItems}
                  showHome={false}
                />
              }
              title={alertName}
              variant="gradient"
            />
          }
          pageTitle={alertName}>
          <Box className="tw:relative tw:min-h-[calc(100vh_-_16rem)] tw:w-full">
            {loadErrorPlaceholder}
          </Box>
        </ObservabilityPageShell>
      );
    }

    return null;
  }, [
    loadingCount,
    viewPermission,
    alertDetails,
    alertDetailsError,
    alertName,
    breadcrumbItems,
    fetchAlertDetails,
    t,
  ]);

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
              subtitle={
                <Typography
                  className="tw:truncate tw:text-secondary"
                  data-testid="alert-details-fqn"
                  size="text-sm"
                  title={fqn}>
                  {fqn}
                </Typography>
              }
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

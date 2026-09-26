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
  Button,
  ButtonUtility,
  Owner,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { Delete, Edit } from '@openmetadata/ui-core-components/icons';
import { RefreshCw01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined, omitBy } from 'lodash';
import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { NO_PERMISSION_FOR_ACTION } from '../../../../../../constants/HelperTextUtil';
import { ResourceEntity } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { AlertDetailTabs } from '../../../../../../enums/Alerts.enum';
import { EntityType } from '../../../../../../enums/entity.enum';
import { EntityReference } from '../../../../../../generated/entity/data/table';
import { EventsRecord } from '../../../../../../generated/events/api/eventsRecord';
import { EventSubscriptionDiagnosticInfo } from '../../../../../../generated/events/api/eventSubscriptionDiagnosticInfo';
import {
  EventSubscription,
  ProviderType,
} from '../../../../../../generated/events/eventSubscription';
import { useEntityPermissions } from '../../../../../../hooks/useEntityPermissions/useEntityPermissions';
import { useSettingsHash } from '../../../../../../hooks/useSettingsHash';
import {
  getAlertsFromName,
  updateNotificationAlert,
} from '../../../../../../rest/alertsAPI';
import {
  getAlertEventsDiagnosticsInfo,
  getDiagnosticInfo,
  syncOffset,
} from '../../../../../../rest/observabilityAPI';
import { hardDeleteEntity } from '../../../../../../utils/DeleteWidget/DeleteWidgetUtils';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import DeleteModal from '../../../../../common/DeleteModal/DeleteModal';
import Loader from '../../../../../common/Loader/Loader';
import RichTextEditor from '../../../../../common/RichTextEditor/RichTextEditor';
import { EditorContentRef } from '../../../../../common/RichTextEditor/RichTextEditor.interface';
import RichTextEditorPreviewerV1 from '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import { UserTeamSelectableList } from '../../../../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import type { NotificationView } from './Notification.types';
import NotificationAlertConfigView from './NotificationAlertConfigView';
import NotificationDiagnosticInfo from './NotificationDiagnosticInfo';
import NotificationRecentEvents from './NotificationRecentEvents';

interface NotificationAlertDetailProps {
  fqn: string;
  onNavigate: (view: NotificationView) => void;
  onNameResolved?: (name: string) => void;
  onSetHeaderActions?: (node: React.ReactNode) => void;
}

// ─── Inline description sub-component ────────────────────────────────────────

interface InlineDescriptionEditorProps {
  canEdit: boolean;
  description: string | undefined;
  editorRef: React.RefObject<EditorContentRef>;
  isEditing: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => void;
  onStartEdit: () => void;
}

const InlineDescriptionEditor: FC<InlineDescriptionEditorProps> = ({
  canEdit,
  description,
  editorRef,
  isEditing,
  isSaving,
  onCancel,
  onSave,
  onStartEdit,
}) => {
  const { t } = useTranslation();

  return (
    <Box className="tw:mb-2" direction="col">
      <Box align="center" direction="row" gap={2}>
        <Typography className="tw:text-primary" weight="medium">
          {t('label.description')}
        </Typography>
        {canEdit && !isEditing && (
          <ButtonUtility
            color="tertiary"
            data-testid="edit-description-btn"
            icon={Edit}
            size="xs"
            tooltip={String(
              t('label.edit-entity', { entity: t('label.description') })
            )}
            onPress={onStartEdit}
          />
        )}
      </Box>

      {isEditing ? (
        <Box data-testid="edit-description-modal" direction="col" gap={2}>
          <RichTextEditor
            className="new-form-style"
            initialValue={description ?? ''}
            ref={editorRef}
          />
          <Box direction="row" gap={2} justify="end">
            <Button
              color="tertiary"
              isDisabled={isSaving}
              size="sm"
              onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              isLoading={isSaving}
              size="sm"
              onPress={onSave}>
              {t('label.save')}
            </Button>
          </Box>
        </Box>
      ) : (
        <>
          {description ? (
            <RichTextEditorPreviewerV1 markdown={description} />
          ) : (
            <Typography className="tw:text-tertiary" size="text-sm">
              --
            </Typography>
          )}
        </>
      )}
    </Box>
  );
};

// ─── Diagnostic stats row ────────────────────────────────────────────────────

const DiagnosticStatsSummary: FC<{
  eventsRecord: EventsRecord;
}> = ({ eventsRecord }) => {
  const { t } = useTranslation();

  return (
    <>
      <Box align="center" direction="row" gap={1}>
        <Typography className="tw:text-tertiary" size="text-sm">
          {`${t('label.total-entity', { entity: t('label.event-plural') })}:`}
        </Typography>
        <Typography size="text-sm" weight="medium">
          {eventsRecord.totalEventsCount ?? 0}
        </Typography>
      </Box>
      <Box align="center" direction="row" gap={1}>
        <Typography className="tw:text-tertiary" size="text-sm">
          {`${t('label.pending-entity', { entity: t('label.event-plural') })}:`}
        </Typography>
        <Typography size="text-sm" weight="medium">
          {eventsRecord.pendingEventsCount ?? 0}
        </Typography>
      </Box>
      <Box align="center" direction="row" gap={1}>
        <Typography className="tw:text-tertiary" size="text-sm">
          {`${t('label.failed-event-plural')}:`}
        </Typography>
        <Typography size="text-sm" weight="medium">
          {eventsRecord.failedEventsCount ?? 0}
        </Typography>
      </Box>
    </>
  );
};

// ─── Header actions builder ──────────────────────────────────────────────────

function buildHeaderActions({
  canDelete,
  canEditAll,
  fqn,
  handleSync,
  isDeleting,
  isSystemProvider,
  isSyncing,
  onNavigate,
  setIsDeleteModalOpen,
  t,
}: {
  canDelete: boolean;
  canEditAll: boolean;
  fqn: string;
  handleSync: () => void;
  isDeleting: boolean;
  isSystemProvider: boolean;
  isSyncing: boolean;
  onNavigate: (view: NotificationView) => void;
  setIsDeleteModalOpen: (open: boolean) => void;
  t: ReturnType<typeof useTranslation>['t'];
}): React.ReactNode {
  return (
    <Box direction="row" gap={2}>
      <ButtonUtility
        color="tertiary"
        data-testid="sync-alert-btn"
        icon={RefreshCw01}
        isDisabled={isSyncing || !canEditAll}
        isLoading={isSyncing}
        size="xs"
        tooltip={String(
          canEditAll
            ? t('label.sync-alert-offset')
            : t(NO_PERMISSION_FOR_ACTION)
        )}
        onPress={handleSync}
      />
      {canEditAll && !isSystemProvider && (
        <ButtonUtility
          color="tertiary"
          data-testid="edit-alert-btn"
          icon={Edit}
          size="xs"
          tooltip={String(t('label.edit'))}
          onPress={() => onNavigate({ type: 'edit', fqn })}
        />
      )}
      {canDelete && !isSystemProvider && (
        <ButtonUtility
          color="tertiary"
          data-testid="delete-alert-btn"
          icon={Delete}
          isDisabled={isDeleting}
          size="xs"
          tooltip={String(t('label.delete'))}
          onPress={() => setIsDeleteModalOpen(true)}
        />
      )}
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const NotificationAlertDetail: FC<NotificationAlertDetailProps> = ({
  fqn,
  onNameResolved,
  onNavigate,
  onSetHeaderActions,
}) => {
  const { t } = useTranslation();

  const { state: hashState, updateParams } = useSettingsHash();
  const initialTab =
    (hashState.params.tab as AlertDetailTabs) || AlertDetailTabs.CONFIGURATION;

  const [alert, setAlert] = useState<EventSubscription>();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AlertDetailTabs>(initialTab);

  const handleTabChange = (key: string | number) => {
    const tab = key as AlertDetailTabs;
    setActiveTab(tab);

    if (tab === AlertDetailTabs.RECENT_EVENTS) {
      updateParams({ tab });
    } else {
      updateParams({ tab, page: undefined, pageSize: undefined });
    }
  };
  const [diagnosticData, setDiagnosticData] =
    useState<EventSubscriptionDiagnosticInfo>();
  const [eventsRecord, setEventsRecord] = useState<EventsRecord>();

  // Inline description editing
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const editorRef = useRef<EditorContentRef>(null);

  // Sync
  const [isSyncing, setIsSyncing] = useState(false);

  // Delete
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Permissions
  const {
    hasViewAccess,
    canEditAll,
    canEditDescription,
    canEditOwners,
    canDelete,
    isLoading: isPermissionLoading,
  } = useEntityPermissions(ResourceEntity.EVENT_SUBSCRIPTION, fqn, {
    enabled: Boolean(fqn),
  });

  const isSystemProvider = useMemo(
    () => alert?.provider === ProviderType.System,
    [alert]
  );

  const editDescriptionPermission = canEditDescription && !isSystemProvider;

  const fetchAlertDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const [alertData, diagData, eventsData] = await Promise.allSettled([
        getAlertsFromName(fqn),
        getDiagnosticInfo(fqn),
        getAlertEventsDiagnosticsInfo({ fqn, listCountOnly: true }),
      ]);

      if (alertData.status === 'fulfilled') {
        setAlert(alertData.value);
      } else {
        showErrorToast(alertData.reason as AxiosError);
      }
      if (diagData.status === 'fulfilled') {
        setDiagnosticData(diagData.value);
      }
      if (eventsData.status === 'fulfilled') {
        setEventsRecord(eventsData.value);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fqn]);

  useEffect(() => {
    if (isPermissionLoading) {
      return;
    }
    if (hasViewAccess) {
      fetchAlertDetails();
    } else {
      setIsLoading(false);
    }
  }, [fetchAlertDetails, hasViewAccess, isPermissionLoading]);

  const handleSaveDescription = useCallback(async () => {
    if (!alert || !editorRef.current) {
      return;
    }

    const newDescription = editorRef.current.getEditorContent();
    const jsonPatch = compare(omitBy(alert, isUndefined), {
      ...alert,
      description: newDescription,
    });

    setIsSavingDescription(true);
    try {
      const updated = await updateNotificationAlert(alert.id ?? '', jsonPatch);
      setAlert(updated);
      setIsEditingDescription(false);
      showSuccessToast(
        t('server.entity-updated-success', { entity: t('label.description') })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSavingDescription(false);
    }
  }, [alert, t]);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await syncOffset(fqn);
      showSuccessToast(t('message.alert-synced-successfully'));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSyncing(false);
    }
  }, [fqn, t]);

  const handleDelete = useCallback(async () => {
    if (!alert) {
      return;
    }

    setIsDeleting(true);
    const isSuccess = await hardDeleteEntity(
      getEntityName(alert),
      alert.id ?? '',
      EntityType.SUBSCRIPTION
    );
    setIsDeleting(false);
    setIsDeleteModalOpen(false);

    if (isSuccess) {
      onNavigate({ type: 'list' });
    }
  }, [alert, onNavigate]);

  const handleOwnerUpdate = useCallback(
    async (updatedOwners?: EntityReference[]) => {
      if (!alert) {
        return;
      }

      const jsonPatch = compare(omitBy(alert, isUndefined), {
        ...alert,
        owners: updatedOwners ?? [],
      });

      try {
        const updated = await updateNotificationAlert(
          alert.id ?? '',
          jsonPatch
        );
        setAlert(updated);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [alert]
  );

  const editOwnersPermission = canEditOwners;

  useEffect(() => {
    if (!alert) {
      return;
    }

    onSetHeaderActions?.(
      buildHeaderActions({
        canDelete,
        canEditAll,
        fqn,
        handleSync,
        isDeleting,
        isSystemProvider,
        isSyncing,
        onNavigate,
        setIsDeleteModalOpen,
        t,
      })
    );
  }, [
    alert,
    canDelete,
    canEditAll,
    fqn,
    handleSync,
    isDeleting,
    isSystemProvider,
    isSyncing,
    onNavigate,
    onSetHeaderActions,
    t,
  ]);

  const alertName = useMemo(() => (alert ? getEntityName(alert) : ''), [alert]);

  useEffect(() => {
    if (alertName) {
      onNameResolved?.(alertName);
    }
  }, [alertName, onNameResolved]);

  if (isLoading || isPermissionLoading) {
    return <Loader />;
  }

  if (!hasViewAccess) {
    return (
      <Box align="center" className="tw:p-8" justify="center">
        <Typography className="tw:text-secondary" size="text-sm">
          {t('message.no-permission-for-action')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      className="tw:pt-1 tw:px-8 tw:pb-8 tw:overflow-y-auto"
      direction="col"
      gap={4}>
      <InlineDescriptionEditor
        canEdit={editDescriptionPermission}
        description={alert?.description}
        editorRef={editorRef}
        isEditing={isEditingDescription}
        isSaving={isSavingDescription}
        onCancel={() => setIsEditingDescription(false)}
        onSave={handleSaveDescription}
        onStartEdit={() => setIsEditingDescription(true)}
      />

      {/* Owners + event-stats summary row */}
      <Box
        align="center"
        className="tw:border tw:border-secondary tw:mb-2 tw:rounded-lg tw:p-3"
        direction="row"
        gap={6}
        wrap="wrap">
        <Box align="center" direction="row" gap={2}>
          <Typography className="tw:text-tertiary tw:shrink-0" size="text-sm">
            {`${t('label.owner-plural')}:`}
          </Typography>
          <Owner
            hasPermission={editOwnersPermission}
            owners={alert?.owners ?? []}
            selectorContent={
              <UserTeamSelectableList
                hasPermission={editOwnersPermission}
                owner={alert?.owners}
                onUpdate={handleOwnerUpdate}
              />
            }
          />
        </Box>
        {eventsRecord && <DiagnosticStatsSummary eventsRecord={eventsRecord} />}
      </Box>

      <Tabs selectedKey={activeTab} onSelectionChange={handleTabChange}>
        <Tabs.List size="sm" type="underline">
          <Tabs.Item id={AlertDetailTabs.CONFIGURATION}>
            {t('label.configuration')}
          </Tabs.Item>
          <Tabs.Item id={AlertDetailTabs.RECENT_EVENTS}>
            {t('label.recent-event-plural')}
          </Tabs.Item>
          <Tabs.Item id={AlertDetailTabs.DIAGNOSTIC_INFO}>
            {t('label.diagnostic-info')}
          </Tabs.Item>
        </Tabs.List>
        <Tabs.Panel
          className="tw:overflow-auto tw:py-4 tw:px-1"
          id={AlertDetailTabs.CONFIGURATION}>
          {alert && <NotificationAlertConfigView alertDetails={alert} />}
        </Tabs.Panel>
        <Tabs.Panel
          className="tw:overflow-auto tw:py-4 tw:px-1"
          id={AlertDetailTabs.RECENT_EVENTS}>
          {alert && <NotificationRecentEvents alertDetails={alert} />}
        </Tabs.Panel>
        <Tabs.Panel
          className="tw:overflow-auto tw:py-4 tw:px-1"
          id={AlertDetailTabs.DIAGNOSTIC_INFO}>
          <NotificationDiagnosticInfo
            diagnosticData={diagnosticData}
            fqn={fqn}
          />
        </Tabs.Panel>
      </Tabs>

      <DeleteModal
        entityTitle={alertName}
        isDeleting={isDeleting}
        message={t('message.permanently-delete-common-message', {
          entity: alertName.toLowerCase(),
        })}
        open={isDeleteModalOpen}
        onCancel={() => setIsDeleteModalOpen(false)}
        onDelete={handleDelete}
      />
    </Box>
  );
};

export default NotificationAlertDetail;

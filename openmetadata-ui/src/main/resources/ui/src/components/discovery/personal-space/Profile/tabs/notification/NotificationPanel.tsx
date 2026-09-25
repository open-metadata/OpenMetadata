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

import type { BreadcrumbItemType } from '@openmetadata/ui-core-components';
import { Box, Button } from '@openmetadata/ui-core-components';
import { Bell01 } from '@untitledui/icons';
import { isEmpty } from 'lodash';
import type { Key } from 'react';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../../../../generated/entity/policies/policy';
import { useSettingsHash } from '../../../../../../hooks/useSettingsHash';
import { checkPermission } from '../../../../../../utils/PermissionsUtils';
import type { ProfileHeaderOverride } from '../../profileNavConfig';
import type { NotificationView } from './Notification.types';
import { hashSubPathToView, viewToSubPath } from './Notification.utils';
import NotificationAlertDetail from './NotificationAlertDetail';
import NotificationAlertForm from './NotificationAlertForm';
import NotificationAlertsPanel from './NotificationAlertsPanel';
import NotificationLanding from './NotificationLanding';

export type { NotificationView };

interface NotificationPanelProps {
  onHeaderChange?: (override: ProfileHeaderOverride | null) => void;
}

const NotificationPanel: FC<NotificationPanelProps> = ({ onHeaderChange }) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const { state: hashState, setHash } = useSettingsHash();

  const view = useMemo<NotificationView>(
    () => hashSubPathToView(hashState.subPath),
    [hashState.subPath]
  );

  const onNavigate = useCallback(
    (nextView: NotificationView) => {
      setHash('notification', viewToSubPath(nextView));
    },
    [setHash]
  );

  // Actions injected by detail panels (e.g. edit/delete buttons).
  const [detailHeaderActions, setDetailHeaderActions] =
    useState<React.ReactNode>(undefined);

  // Clear detail header state when navigating away.
  useEffect(() => {
    setDetailHeaderActions(undefined);
  }, [view.type]);

  const canAddAlert = useMemo(
    () =>
      !isEmpty(permissions) &&
      checkPermission(
        Operation.Create,
        ResourceEntity.EVENT_SUBSCRIPTION,
        permissions
      ),
    [permissions]
  );

  const [resolvedDetailName, setResolvedDetailName] = useState<string>('');

  // Push header updates up to ProfilePage whenever the internal view changes.
  useEffect(() => {
    if (!onHeaderChange) {
      return;
    }

    const settingsLabel = t('label.setting-plural');
    const notificationLabel = t('label.notification');
    const alertsLabel = t('label.alert-plural');
    const addAlertLabel = t('label.add-entity', { entity: t('label.alert') });
    const editAlertLabel = t('label.edit-entity', {
      entity: t('label.alert'),
    });

    const settingsItem: BreadcrumbItemType = {
      id: 'settings',
      label: settingsLabel,
    };
    const notificationItem: BreadcrumbItemType = {
      id: 'notification',
      label: notificationLabel,
    };
    const alertsItem: BreadcrumbItemType = { id: 'alerts', label: alertsLabel };

    const breadcrumbs: BreadcrumbItemType[] = (() => {
      if (view.type === 'landing') {
        return [settingsItem, { id: 'current', label: notificationLabel }];
      }

      if (view.type === 'list') {
        return [
          settingsItem,
          notificationItem,
          { id: 'current', label: alertsLabel },
        ];
      }

      if (view.type === 'add') {
        return [
          settingsItem,
          notificationItem,
          alertsItem,
          { id: 'current', label: addAlertLabel },
        ];
      }

      if (view.type === 'edit') {
        return [
          settingsItem,
          notificationItem,
          alertsItem,
          { id: 'current', label: editAlertLabel },
        ];
      }

      if (view.type === 'detail') {
        return [
          settingsItem,
          notificationItem,
          alertsItem,
          { id: 'current', label: resolvedDetailName || view.name },
        ];
      }

      return [settingsItem, { id: 'current', label: notificationLabel }];
    })();

    const title: string = (() => {
      if (view.type === 'landing') {
        return notificationLabel;
      }

      if (view.type === 'list') {
        return alertsLabel;
      }

      if (view.type === 'add') {
        return addAlertLabel;
      }

      if (view.type === 'edit') {
        return editAlertLabel;
      }

      if (view.type === 'detail') {
        return resolvedDetailName || view.name;
      }

      return notificationLabel;
    })();

    const description = t('message.alerts-description');

    const onBreadcrumbAction = (id: Key) => {
      if (id === 'notification') {
        onNavigate({ type: 'landing' });
      } else if (id === 'alerts') {
        onNavigate({ type: 'list' });
      }
    };

    const actions: React.ReactNode = (() => {
      if (view.type === 'list' && canAddAlert) {
        return (
          <Button
            color="primary"
            data-testid="add-alert"
            size="sm"
            onPress={() => onNavigate({ type: 'add' })}>
            {addAlertLabel}
          </Button>
        );
      }

      if (view.type === 'detail') {
        return detailHeaderActions;
      }

      return undefined;
    })();

    onHeaderChange({
      actions,
      breadcrumbs,
      description,
      icon: Bell01,
      onBreadcrumbAction,
      title,
    });
  }, [
    view,
    onHeaderChange,
    t,
    canAddAlert,
    detailHeaderActions,
    onNavigate,
    resolvedDetailName,
  ]);

  const content = (() => {
    if (view.type === 'landing') {
      return <NotificationLanding onNavigate={onNavigate} />;
    }

    if (view.type === 'list') {
      return <NotificationAlertsPanel onNavigate={onNavigate} />;
    }

    if (view.type === 'add') {
      if (!canAddAlert) {
        onNavigate({ type: 'list' });

        return null;
      }

      return <NotificationAlertForm onNavigate={onNavigate} />;
    }

    if (view.type === 'edit') {
      return <NotificationAlertForm fqn={view.fqn} onNavigate={onNavigate} />;
    }

    if (view.type === 'detail') {
      return (
        <NotificationAlertDetail
          fqn={view.fqn}
          onNameResolved={setResolvedDetailName}
          onNavigate={onNavigate}
          onSetHeaderActions={setDetailHeaderActions}
        />
      );
    }

    return null;
  })();

  return (
    <Box className="tw:flex-1 tw:overflow-hidden" direction="col">
      {content}
    </Box>
  );
};

export default NotificationPanel;

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
import {
  Box,
  Button,
  EmptyPlaceholder,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Bell01,
  Lightbulb05,
  Lock01 as Lock,
} from '@openmetadata/ui-core-components/icons';
import { isEmpty } from 'lodash';
import type { Key } from 'react';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../../../../generated/entity/policies/policy';
import { useAuth } from '../../../../../../hooks/authHooks';
import { useSettingsHash } from '../../../../../../hooks/useSettingsHash';
import {
  EXTENSION_POINTS,
  NotificationSectionContribution,
} from '../../../../../../utils/ExtensionPointTypes';
import { checkPermission } from '../../../../../../utils/PermissionsUtils';
import Loader from '../../../../../common/Loader/Loader';
import { useApplicationsProvider } from '../../../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import type { ProfileHeaderOverride } from '../../profileNavConfig';
import type { NotificationIcon, NotificationView } from './Notification.types';
import {
  findNotificationMenuItem,
  getNotificationMenuItems,
  hashSubPathToView,
  isNotificationMenuItemVisible,
  splitSectionPath,
  viewToSubPath,
} from './Notification.utils';
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
  const { isAdminUser } = useAuth();
  const { extensionRegistry, contributionsVersion } = useApplicationsProvider();
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
  // Header state injected by a contributed section (Create button, sub-page
  // title). Tagged with the owning section key instead of being cleared on
  // navigation: child effects run before parent effects, so a parent-side
  // reset would wipe what the section just pushed on mount.
  const [sectionHeader, setSectionHeader] = useState<{
    key?: string;
    actions?: React.ReactNode;
    subTitle?: string;
  }>({});
  const [resolvedDetailName, setResolvedDetailName] = useState<string>('');
  const [showHint, setShowHint] = useState(false);

  const viewFqn = 'fqn' in view ? view.fqn : undefined;

  // Keyed on `contributionsVersion` too: the registry is mutated in place when
  // plugins contribute, so its identity alone would never trigger a recompute.
  // contributionsVersion is the only signal that plugins have registered their
  // sections (the registry is mutated in place); removing it as "unnecessary"
  // leaves a deep-linked section with nothing to render.
  const sectionContributions = useMemo(
    () =>
      extensionRegistry.getContributions<NotificationSectionContribution>(
        EXTENSION_POINTS.NOTIFICATION_LANDING_SECTIONS
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
    [extensionRegistry, contributionsVersion]
  );

  const sectionPath = useMemo(
    () =>
      view.type === 'section'
        ? splitSectionPath(
            view.key,
            sectionContributions.map((contribution) => contribution.key)
          )
        : undefined,
    [view, sectionContributions]
  );
  const viewSectionKey = sectionPath?.key;
  const sectionSubPath = sectionPath?.subPath;

  const isOwnSectionHeader = Boolean(
    viewSectionKey && sectionHeader.key === viewSectionKey
  );
  const sectionHeaderActions = isOwnSectionHeader
    ? sectionHeader.actions
    : undefined;
  const sectionSubTitle = isOwnSectionHeader
    ? sectionHeader.subTitle
    : undefined;

  const setSectionHeaderActions = useCallback(
    (actions: React.ReactNode | null) =>
      setSectionHeader((prev) => ({
        ...(prev.key === viewSectionKey ? prev : {}),
        key: viewSectionKey,
        actions: actions ?? undefined,
      })),
    [viewSectionKey]
  );

  const setSectionSubTitle = useCallback(
    (subTitle: string | null) =>
      setSectionHeader((prev) => ({
        ...(prev.key === viewSectionKey ? prev : {}),
        key: viewSectionKey,
        subTitle: subTitle ?? undefined,
      })),
    [viewSectionKey]
  );

  const onSectionNavigate = useCallback(
    (subPath?: string, params?: Record<string, string | undefined>) => {
      if (viewSectionKey) {
        setHash(
          'notification',
          viewToSubPath({ type: 'section', key: viewSectionKey, subPath }),
          params
        );
      }
    },
    [viewSectionKey, setHash]
  );

  // Resolve the contributed section component + its menu label for the active
  // `section` view. Both come from the same sources NotificationLanding uses:
  // the component from the extension registry, the label from the global
  // settings Notifications menu (keyed by option suffix).
  const section = useMemo(() => {
    if (!viewSectionKey) {
      return undefined;
    }

    const contribution = sectionContributions.find(
      (item: NotificationSectionContribution) => item.key === viewSectionKey
    );
    const menuItem = findNotificationMenuItem(
      getNotificationMenuItems(permissions, Boolean(isAdminUser)),
      viewSectionKey
    );
    // Same rule as the landing cards, so a hidden card cannot be reached by URL.
    const isAllowed = isNotificationMenuItemVisible(menuItem);

    return {
      Component: isAllowed ? contribution?.component : undefined,
      isDenied: Boolean(contribution) && !isAllowed,
      label: menuItem?.category ?? menuItem?.label ?? viewSectionKey,
      description: menuItem?.description,
      // Same resolution as the landing card, so header and card match.
      icon: (contribution?.icon ?? menuItem?.icon) as
        | NotificationIcon
        | undefined,
    };
  }, [viewSectionKey, sectionContributions, permissions, isAdminUser]);

  const sectionContent = useMemo(() => {
    const SectionComponent = section?.Component;

    // Until permissions load every gated item looks hidden; wait rather than
    // flash Access Denied on a deep link.
    if (!SectionComponent && isEmpty(permissions)) {
      return <Loader />;
    }

    if (!SectionComponent) {
      return (
        <Box className="tw:relative tw:min-h-60">
          <EmptyPlaceholder
            icon={
              section?.isDenied ? (
                <Lock className="tw:text-secondary" />
              ) : undefined
            }
            title={t(
              section?.isDenied ? 'label.access-denied' : 'label.no-data'
            )}
            variant="blank"
          />
        </Box>
      );
    }

    return (
      <SectionComponent
        subPath={sectionSubPath}
        onClose={() => onNavigate({ type: 'landing' })}
        onNavigate={onSectionNavigate}
        onSetHeaderActions={setSectionHeaderActions}
        onSetSubTitle={setSectionSubTitle}
      />
    );
  }, [
    section,
    permissions,
    t,
    onNavigate,
    sectionSubPath,
    onSectionNavigate,
    setSectionHeaderActions,
    setSectionSubTitle,
  ]);

  // Clear detail header state when navigating away.
  useEffect(() => {
    setDetailHeaderActions(undefined);
    setResolvedDetailName('');
  }, [view.type, viewFqn]);

  const permissionsLoaded = !isEmpty(permissions);

  const canAddAlert = useMemo(
    () =>
      permissionsLoaded &&
      checkPermission(
        Operation.Create,
        ResourceEntity.EVENT_SUBSCRIPTION,
        permissions
      ),
    [permissions, permissionsLoaded]
  );

  const canEditAlert = useMemo(
    () =>
      permissionsLoaded &&
      checkPermission(
        Operation.EditAll,
        ResourceEntity.EVENT_SUBSCRIPTION,
        permissions
      ),
    [permissions, permissionsLoaded]
  );

  useEffect(() => {
    if (view.type === 'add' && permissionsLoaded && !canAddAlert) {
      onNavigate({ type: 'list' });
    }
  }, [view.type, permissionsLoaded, canAddAlert, onNavigate]);

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
    const sectionLabel = section?.label ?? notificationLabel;
    // A named sub-page turns the section crumb into a link back to its root.
    const sectionCrumbs: BreadcrumbItemType[] = sectionSubTitle
      ? [
          { id: 'section', label: sectionLabel },
          { id: 'current', label: sectionSubTitle },
        ]
      : [{ id: 'current', label: sectionLabel }];

    const breadcrumbs: BreadcrumbItemType[] = (() => {
      if (view.type === 'landing') {
        return [settingsItem, { id: 'current', label: notificationLabel }];
      }

      if (view.type === 'section') {
        return [settingsItem, notificationItem, ...sectionCrumbs];
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

      if (view.type === 'section') {
        return sectionSubTitle ?? sectionLabel;
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

    const description =
      view.type === 'section' && section?.description
        ? section.description
        : t('message.alerts-description');

    const onBreadcrumbAction = (id: Key) => {
      if (id === 'notification') {
        onNavigate({ type: 'landing' });
      } else if (id === 'alerts') {
        onNavigate({ type: 'list' });
      } else if (id === 'section') {
        onSectionNavigate();
      }
    };

    const hintToggle =
      view.type === 'add' || view.type === 'edit' ? (
        <Box align="center" direction="row" gap={2}>
          <Lightbulb05 className="tw:size-4.5 tw:text-secondary" />
          <Typography size="text-sm" weight="medium">
            {t('label.show-hint')}
          </Typography>
          <Toggle isSelected={showHint} onChange={setShowHint} />
        </Box>
      ) : undefined;

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

      if (view.type === 'add' || view.type === 'edit') {
        return hintToggle;
      }

      if (view.type === 'detail') {
        return detailHeaderActions;
      }

      if (view.type === 'section') {
        return sectionHeaderActions;
      }

      return undefined;
    })();

    onHeaderChange({
      actions,
      breadcrumbs,
      description,
      icon: (view.type === 'section' && section?.icon) || Bell01,
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
    showHint,
    resolvedDetailName,
    section,
    sectionHeaderActions,
    sectionSubTitle,
    onSectionNavigate,
  ]);

  const content = (() => {
    // `section` is resolved in `sectionContent` above and handled in the
    // return below, so it is intentionally not a branch here.
    if (view.type === 'landing') {
      return <NotificationLanding onNavigate={onNavigate} />;
    }

    if (view.type === 'list') {
      return <NotificationAlertsPanel onNavigate={onNavigate} />;
    }

    if (view.type === 'add') {
      if (!permissionsLoaded) {
        return <Loader />;
      }

      return canAddAlert ? (
        <NotificationAlertForm showHint={showHint} onNavigate={onNavigate} />
      ) : null;
    }

    if (view.type === 'edit') {
      if (!permissionsLoaded) {
        return <Loader />;
      }

      if (!canEditAlert) {
        return (
          <Box className="tw:relative tw:min-h-60">
            <EmptyPlaceholder
              icon={<Lock className="tw:text-secondary" />}
              title={t('label.access-denied')}
              variant="blank"
            />
          </Box>
        );
      }

      return (
        <NotificationAlertForm
          fqn={view.fqn}
          showHint={showHint}
          onNavigate={onNavigate}
        />
      );
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
      {view.type === 'section' ? sectionContent : content}
    </Box>
  );
};

export default NotificationPanel;

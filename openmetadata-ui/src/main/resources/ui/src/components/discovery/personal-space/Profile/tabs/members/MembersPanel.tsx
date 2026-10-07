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

import { Box, EmptyPlaceholder } from '@openmetadata/ui-core-components';
import { Lock01 } from '@openmetadata/ui-core-components/icons';
import { isEmpty } from 'lodash';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../../../../generated/entity/policies/policy';
import { useAuth } from '../../../../../../hooks/authHooks';
import { useSettingsHash } from '../../../../../../hooks/useSettingsHash';
import { checkPermission } from '../../../../../../utils/PermissionsUtils';
import { EntityExportModalProvider } from '../../../../../Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import type { MembersPanelProps, MembersView } from './Members.types';
import {
  buildMembersHeaderMaps,
  hashSubPathToView,
  isTeamsOrDetailView,
  makeBreadcrumbAction,
  viewToSubPath,
} from './Members.utils';
import MembersAddTeamForm from './MembersAddTeamForm';
import MembersCreateUserForm from './MembersCreateUserForm';
import MembersImportForm from './MembersImportForm';
import MembersLanding from './MembersLanding';
import MembersOnlineUsersPanel from './MembersOnlineUsersPanel';
import MembersTeamDetail from './MembersTeamDetail';
import MembersUsersPanel from './MembersUsersPanel';

const TEAM_DETAIL = 'team-detail' as const;
const TEAMS_ADD = 'teams-add' as const;
const TEAMS_IMPORT = 'teams-import' as const;
const USER_CREATE = 'user-create' as const;

const MembersPanel: FC<MembersPanelProps> = ({ onHeaderChange }) => {
  const { t } = useTranslation();
  const { state: hashState, setHash } = useSettingsHash();
  const { permissions } = usePermissionProvider();
  const { isAdminUser } = useAuth();

  // Create permissions gate the form views directly, since those views are
  // reachable by deep-linking the hash even when the create button is hidden.
  // Admins bypass the resource check (user/team creation is admin-gated).
  const canCreateTeam = useMemo(
    () =>
      isAdminUser ||
      (!isEmpty(permissions) &&
        checkPermission(Operation.Create, ResourceEntity.TEAM, permissions)),
    [isAdminUser, permissions]
  );
  const canCreateUser = useMemo(
    () =>
      isAdminUser ||
      (!isEmpty(permissions) &&
        checkPermission(Operation.Create, ResourceEntity.USER, permissions)),
    [isAdminUser, permissions]
  );

  // Hash-synced navigation (same pattern as NotificationPanel / AccessControlPanel):
  // the view is derived from the hash sub-path and every navigation writes the hash,
  // so deep links, browser back, and shareable URLs all work.
  const view = useMemo<MembersView>(
    () => hashSubPathToView(hashState.subPath),
    [hashState.subPath]
  );

  const onNavigate = useCallback(
    (nextView: MembersView) => {
      setHash('members', viewToSubPath(nextView));
    },
    [setHash]
  );

  // A form view reached without the matching create permission (e.g. via a deep
  // link) renders the lock placeholder instead of the form.
  const isDeniedFormView = useMemo(() => {
    if (view.type === TEAMS_ADD) {
      return !canCreateTeam;
    }
    if (view.type === TEAMS_IMPORT) {
      return !(view.importType === 'users' ? canCreateUser : canCreateTeam);
    }
    if (view.type === USER_CREATE) {
      return !canCreateUser;
    }

    return false;
  }, [view, canCreateTeam, canCreateUser]);

  // Stable no-op for the Organization view (its name isn't editable) so the
  // team-detail's fetch effect, which depends on onRename, can't re-fire.
  const noopRename = useCallback(() => undefined, []);

  const [panelHeaderActions, setPanelHeaderActions] =
    useState<React.ReactNode>(undefined);
  const [detailHeaderTitleInput, setDetailHeaderTitleInput] =
    useState<React.ReactNode>(undefined);
  const [detailHeaderTitleSuffix, setDetailHeaderTitleSuffix] =
    useState<React.ReactNode>(undefined);
  // The team-detail view's sub-path only carries the FQN; MembersTeamDetail
  // reports the fetched team's display name back here so the header/breadcrumb
  // show it (and update live on rename) instead of the raw FQN.
  const [resolvedTeamName, setResolvedTeamName] = useState('');

  // One header setter for the children: a partial patch merged into the three
  // slots (only the keys present are touched, so a panel that owns just `actions`
  // can't clobber the title slots).
  const setPanelHeader = useCallback(
    (patch: {
      actions?: React.ReactNode;
      titleInput?: React.ReactNode;
      titleSuffix?: React.ReactNode;
    }) => {
      if ('actions' in patch) {
        setPanelHeaderActions(patch.actions);
      }
      if ('titleInput' in patch) {
        setDetailHeaderTitleInput(patch.titleInput);
      }
      if ('titleSuffix' in patch) {
        setDetailHeaderTitleSuffix(patch.titleSuffix);
      }
    },
    []
  );

  const viewFqn = view.type === TEAM_DETAIL ? view.fqn : undefined;

  useEffect(() => {
    // Header actions are owned by each child panel (set + unmount-cleanup), so
    // the parent must NOT clear them here: React runs child effects before the
    // parent's, so clearing would clobber a button the child just set in the
    // same commit (the add-user button vanishing when isAdmin is already loaded).
    setDetailHeaderTitleInput(undefined);
    setDetailHeaderTitleSuffix(undefined);
    setResolvedTeamName('');
  }, [view.type, viewFqn]);

  useEffect(() => {
    if (!onHeaderChange) {
      return;
    }

    const { crumbsByType, titleByType, iconByType, descByType } =
      buildMembersHeaderMaps(view, t, resolvedTeamName);
    const pick = (node: React.ReactNode) =>
      isTeamsOrDetailView(view) ? node : undefined;

    onHeaderChange({
      breadcrumbs: crumbsByType[view.type],
      title: titleByType[view.type],
      description: descByType[view.type],
      icon: iconByType[view.type],
      onBreadcrumbAction: makeBreadcrumbAction(onNavigate),
      actions: panelHeaderActions,
      titleInput: pick(detailHeaderTitleInput),
      titleSuffix: pick(detailHeaderTitleSuffix),
    });
  }, [
    view,
    onHeaderChange,
    onNavigate,
    t,
    panelHeaderActions,
    detailHeaderTitleInput,
    detailHeaderTitleSuffix,
    resolvedTeamName,
  ]);

  const permissionPlaceholder = (
    <Box
      className="tw:relative tw:h-full"
      data-testid="permission-error-placeholder">
      <EmptyPlaceholder
        description={t('message.no-permission-for-action')}
        icon={<Lock01 />}
        title={t('label.no-access')}
      />
    </Box>
  );

  const renderView = () => {
    if (view.type === 'landing') {
      return <MembersLanding onNavigate={onNavigate} />;
    }

    if (view.type === 'teams') {
      return (
        <MembersTeamDetail
          fqn="Organization"
          key="Organization"
          onNavigate={onNavigate}
          onRename={noopRename}
          onSetHeader={setPanelHeader}
        />
      );
    }

    if (view.type === TEAM_DETAIL) {
      return (
        <MembersTeamDetail
          fqn={view.fqn}
          key={view.fqn}
          onNavigate={onNavigate}
          onRename={setResolvedTeamName}
          onSetHeader={setPanelHeader}
        />
      );
    }

    if (view.type === TEAMS_ADD) {
      const parentFqn = view.parentFqn;
      const back = () =>
        parentFqn
          ? onNavigate({ type: TEAM_DETAIL, fqn: parentFqn, name: parentFqn })
          : onNavigate({ type: 'teams' });

      return (
        <MembersAddTeamForm
          parentTeamFqn={parentFqn}
          onCancel={back}
          onSave={back}
        />
      );
    }

    if (view.type === TEAMS_IMPORT) {
      const { fqn, importType } = view;
      const back = () =>
        fqn === 'Organization'
          ? onNavigate({ type: 'teams' })
          : onNavigate({ type: TEAM_DETAIL, fqn, name: fqn });

      return (
        <MembersImportForm fqn={fqn} importType={importType} onClose={back} />
      );
    }

    if (view.type === 'users') {
      return (
        // Keyed so switching Users <-> Admins remounts the panel: both render the
        // same component type, and its fetch effects don't depend on isAdmin, so
        // without a key React would keep the instance and show the stale list.
        <MembersUsersPanel
          key="users"
          onNavigate={onNavigate}
          onSetHeader={setPanelHeader}
        />
      );
    }

    if (view.type === 'admins') {
      return (
        <MembersUsersPanel
          isAdmin
          key="admins"
          onNavigate={onNavigate}
          onSetHeader={setPanelHeader}
        />
      );
    }

    if (view.type === USER_CREATE) {
      return (
        <MembersCreateUserForm isAdmin={view.isAdmin} onNavigate={onNavigate} />
      );
    }

    if (view.type === 'online-users') {
      return <MembersOnlineUsersPanel onNavigate={onNavigate} />;
    }

    return null;
  };

  const content = isDeniedFormView ? permissionPlaceholder : renderView();

  return (
    <EntityExportModalProvider>
      <div className="tw:flex-1 tw:min-h-0 tw:overflow-y-auto">{content}</div>
    </EntityExportModalProvider>
  );
};

export default MembersPanel;

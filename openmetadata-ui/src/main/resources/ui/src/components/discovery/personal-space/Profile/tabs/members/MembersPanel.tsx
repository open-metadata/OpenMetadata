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
import { Box, EmptyPlaceholder } from '@openmetadata/ui-core-components';
import {
  Clock,
  Lock01,
  ShieldTick,
  User01,
  Users01,
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
import { checkPermission } from '../../../../../../utils/PermissionsUtils';
import { EntityExportModalProvider } from '../../../../../Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import type { MembersPanelProps, MembersView } from './Members.types';
import { hashSubPathToView, viewToSubPath } from './Members.utils';
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

// Pure header maps extracted to module scope to keep the header effect's
// cyclomatic complexity within budget.
const getMembersIcons = (
  createUserIsAdmin: boolean
): Record<MembersView['type'], FC<{ className?: string }>> => ({
  landing: Users01,
  teams: Users01,
  [TEAM_DETAIL]: Users01,
  'teams-add': Users01,
  'teams-import': Users01,
  users: User01,
  admins: ShieldTick,
  'user-create': createUserIsAdmin ? ShieldTick : User01,
  'online-users': Clock,
});

const getMembersDescriptions = (
  t: (key: string) => string,
  createUserIsAdmin: boolean
): Record<MembersView['type'], string> => ({
  landing: t('message.team-member-management-description'),
  teams: t('message.members-teams-description'),
  [TEAM_DETAIL]: t('message.members-teams-description'),
  'teams-add': t('message.members-teams-description'),
  'teams-import': t('message.members-teams-description'),
  users: t('message.members-users-description'),
  admins: t('message.members-admins-description'),
  'user-create': createUserIsAdmin
    ? t('message.members-admins-description')
    : t('message.members-users-description'),
  'online-users': t('message.members-online-users-description'),
});

const makeBreadcrumbAction =
  (onNavigate: (view: MembersView) => void) => (id: Key) => {
    if (id === 'members') {
      onNavigate({ type: 'landing' });
    } else if (id === 'teams') {
      onNavigate({ type: 'teams' });
    } else if (id === 'users') {
      onNavigate({ type: 'users' });
    } else if (id === 'admins') {
      onNavigate({ type: 'admins' });
    }
  };

const isTeamsOrDetailView = (view: MembersView): boolean =>
  view.type === 'teams' || view.type === TEAM_DETAIL || view.type === TEAMS_ADD;

// Builds the per-view breadcrumb/title/icon/description maps. Kept at module
// scope (pure) so the header effect stays within its complexity budget.
const buildMembersHeaderMaps = (
  view: MembersView,
  t: (key: string, opts?: Record<string, unknown>) => string,
  resolvedTeamName: string
) => {
  const membersLabel = t('label.member-plural');
  const organizationLabel = t('label.organization');
  const teamsLabel = t('label.team-plural');
  const usersLabel = t('label.user-plural');
  const adminsLabel = t('label.admin-plural');
  const onlineUsersLabel = t('label.online-user-plural');
  const addTeamLabel = t('label.add-entity', { entity: t('label.team') });
  const importIsUser =
    view.type === TEAMS_IMPORT && view.importType === 'users';
  const importLabel = t('label.import-entity', {
    entity: importIsUser ? t('label.user') : t('label.team'),
  });
  const teamName =
    view.type === TEAM_DETAIL ? resolvedTeamName || view.name : '';

  const settingsItem: BreadcrumbItemType = {
    id: 'settings',
    label: t('label.setting-plural'),
  };
  const membersItem: BreadcrumbItemType = {
    id: 'members',
    label: membersLabel,
  };
  const teamsItem: BreadcrumbItemType = {
    id: 'teams',
    label: organizationLabel,
  };
  const usersItem: BreadcrumbItemType = { id: 'users', label: usersLabel };
  const adminsItem: BreadcrumbItemType = { id: 'admins', label: adminsLabel };
  const base = [settingsItem, membersItem];

  const createUserIsAdmin = view.type === USER_CREATE && Boolean(view.isAdmin);
  const createUserLabel = t('label.create-entity', {
    entity: createUserIsAdmin ? t('label.admin') : t('label.user'),
  });

  const crumbsByType: Record<MembersView['type'], BreadcrumbItemType[]> = {
    landing: [settingsItem, { id: 'current', label: membersLabel }],
    teams: [...base, { id: 'current', label: teamsLabel }],
    [TEAM_DETAIL]: [...base, teamsItem, { id: 'current', label: teamName }],
    'teams-add': [...base, teamsItem, { id: 'current', label: addTeamLabel }],
    'teams-import': [...base, teamsItem, { id: 'current', label: importLabel }],
    users: [...base, { id: 'current', label: usersLabel }],
    admins: [...base, { id: 'current', label: adminsLabel }],
    'user-create': [
      ...base,
      createUserIsAdmin ? adminsItem : usersItem,
      { id: 'current', label: createUserLabel },
    ],
    'online-users': [...base, { id: 'current', label: onlineUsersLabel }],
  };

  const titleByType: Record<MembersView['type'], string> = {
    landing: membersLabel,
    teams: organizationLabel,
    [TEAM_DETAIL]: teamName,
    'teams-add': addTeamLabel,
    'teams-import': importLabel,
    users: usersLabel,
    admins: adminsLabel,
    'user-create': createUserLabel,
    'online-users': onlineUsersLabel,
  };

  return {
    crumbsByType,
    titleByType,
    iconByType: getMembersIcons(createUserIsAdmin),
    descByType: getMembersDescriptions(t, createUserIsAdmin),
  };
};

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

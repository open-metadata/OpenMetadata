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
  Badge,
  Box,
  Button,
  ButtonUtility,
  Dropdown,
  Input,
} from '@openmetadata/ui-core-components';
import {
  Download01,
  Edit01,
  Lock01,
  Restore,
  Trash01,
  Upload01,
} from '@openmetadata/ui-core-components/icons';
import { ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Team } from '../../../../../../generated/entity/teams/team';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import type { UseMembersTeamHeaderParams } from './MembersTeamDetail.types';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

const buildTitleSuffix = (
  t: TranslateFn,
  team: Team,
  canEdit: boolean,
  isEditingName: boolean,
  onStartEditName: (value: string) => void
): ReactNode => {
  if (isEditingName) {
    return undefined;
  }

  // Edit is gated off on a deleted team, so the pencil is hidden there; the
  // deleted badge takes its place next to the name.
  return (
    <Box align="center" direction="row" gap={2}>
      {team.deleted && (
        <Badge color="error" data-testid="deleted-badge" size="sm">
          {t('label.deleted')}
        </Badge>
      )}
      {canEdit && (
        <ButtonUtility
          aria-label={t('label.edit-entity', {
            entity: t('label.display-name'),
          })}
          color="tertiary"
          data-testid="edit-display-name"
          icon={Edit01}
          size="xs"
          onClick={() => onStartEditName(getEntityName(team))}
        />
      )}
    </Box>
  );
};

const buildTitleInput = (
  t: TranslateFn,
  isEditingName: boolean,
  editNameValue: string,
  onEditNameValueChange: (value: string) => void,
  onSaveDisplayName: () => void,
  onCancelEditName: () => void
): ReactNode =>
  isEditingName ? (
    <Box align="center" direction="row" gap={2}>
      <Input
        data-testid="display-name-input"
        size="sm"
        value={editNameValue}
        onChange={(value) => onEditNameValueChange(value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onSaveDisplayName();
          } else if (e.key === 'Escape') {
            onCancelEditName();
          }
        }}
      />
      <Button
        color="primary"
        data-testid="save-display-name"
        size="xs"
        onPress={onSaveDisplayName}>
        {t('label.save')}
      </Button>
      <Button
        color="tertiary"
        data-testid="cancel-display-name"
        size="xs"
        onPress={onCancelEditName}>
        {t('label.cancel')}
      </Button>
    </Box>
  ) : undefined;

const getJoinableLabel = (t: TranslateFn, team: Team): string =>
  team.isJoinable ? t('label.make-private') : t('label.make-public');

interface TeamMenuItems {
  exportTeam: boolean;
  importTeam: boolean;
  toggleJoinable: boolean;
  restore: boolean;
  remove: boolean;
}

// Classic hides a team's Manage menu from anyone who cannot edit it, except
// on the Organization; the "..." trigger goes with it when nothing is left.
const getTeamMenuItems = (
  team: Team,
  params: UseMembersTeamHeaderParams
): TeamMenuItems => {
  const {
    canCreateTeam,
    canDelete,
    canEditAll,
    canRestore,
    isGroupType,
    isOrgType,
  } = params;
  const isLive = !team.deleted;
  // Can't restore into a deleted parent — mirrors the legacy team page.
  const parentDeleted = Boolean(team.parents?.[0]?.deleted);
  const canManage = isOrgType || canEditAll;
  const exportTeam = !isGroupType && isLive && canManage;

  return {
    exportTeam,
    importTeam: exportTeam && canCreateTeam,
    toggleJoinable: !isOrgType && isLive && canEditAll,
    restore: !isLive && canRestore && !parentDeleted,
    remove: canDelete && !isOrgType,
  };
};

// Renders only the items getTeamMenuItems allows, in menu order.
const buildTeamActionsMenu = (
  t: TranslateFn,
  items: TeamMenuItems,
  team: Team,
  params: UseMembersTeamHeaderParams
): ReactNode => {
  const {
    onDelete,
    onRestoreTeam,
    onTeamExport,
    onTeamImport,
    onToggleJoinable,
  } = params;

  return (
    <Dropdown.Menu>
      {items.exportTeam && (
        <Dropdown.Item
          data-testid="export-team"
          icon={Download01}
          onAction={onTeamExport}>
          {t('label.export-entity', {
            entity: t('label.team'),
          })}
        </Dropdown.Item>
      )}
      {items.importTeam && (
        <Dropdown.Item
          data-testid="import-team"
          icon={Upload01}
          onAction={onTeamImport}>
          {t('label.import-entity', {
            entity: t('label.team'),
          })}
        </Dropdown.Item>
      )}
      {items.toggleJoinable && (
        <Dropdown.Item
          data-testid="toggle-joinable"
          icon={Lock01}
          onAction={onToggleJoinable}>
          {getJoinableLabel(t, team)}
        </Dropdown.Item>
      )}
      {items.restore && (
        <Dropdown.Item
          data-testid="restore-team"
          icon={Restore}
          onAction={onRestoreTeam}>
          {t('label.restore-entity', {
            entity: t('label.team'),
          })}
        </Dropdown.Item>
      )}
      {items.remove && (
        <Dropdown.Item
          data-testid="delete-team"
          icon={Trash01}
          onAction={onDelete}>
          {t('label.delete')}
        </Dropdown.Item>
      )}
    </Dropdown.Menu>
  );
};

// A member can always leave; joining is only offered on joinable teams (admins
// hold canEditAll, so they can still join a private team).
const canJoinOrLeave = (
  team: Team,
  { canEditAll, isCurrentUserMember, isGroupType }: UseMembersTeamHeaderParams
): boolean =>
  Boolean(isGroupType) &&
  !team.deleted &&
  Boolean(isCurrentUserMember || team.isJoinable || canEditAll);

const buildHeaderActions = (
  t: TranslateFn,
  team: Team,
  params: UseMembersTeamHeaderParams
): ReactNode => {
  const { isCurrentUserMember, onJoinTeam, onLeaveTeam } = params;
  const showJoinLeave = canJoinOrLeave(team, params);
  const menuItems = getTeamMenuItems(team, params);
  const hasMenu = Object.values(menuItems).some(Boolean);

  return (
    <Box align="center" direction="row" gap={2}>
      {showJoinLeave && (
        <Button
          color={isCurrentUserMember ? 'secondary' : 'primary'}
          data-testid={
            isCurrentUserMember ? 'leave-team-button' : 'join-team-button'
          }
          size="xs"
          onPress={isCurrentUserMember ? onLeaveTeam : onJoinTeam}>
          {isCurrentUserMember ? t('label.leave-team') : t('label.join-team')}
        </Button>
      )}
      {hasMenu && (
        <Dropdown.Root>
          <Dropdown.DotsButton />
          <Dropdown.Popover className="tw:w-min">
            {buildTeamActionsMenu(t, menuItems, team, params)}
          </Dropdown.Popover>
        </Dropdown.Root>
      )}
    </Box>
  );
};

export const useMembersTeamHeader = (
  params: UseMembersTeamHeaderParams
): void => {
  const { t } = useTranslation();
  const {
    team,
    isLoading,
    isEditingName,
    editNameValue,
    canEditAll,
    canEditDisplayName,
    onEditNameValueChange,
    onStartEditName,
    onCancelEditName,
    onSaveDisplayName,
    onSetHeader,
  } = params;

  // The header content depends on the values below, but the builders also take
  // several callbacks (onSetHeader, onEditNameValueChange, …) whose identities
  // shouldn't re-publish the header. Read everything through a ref so the effect
  // can key on just the content-affecting values without an exhaustive-deps
  // disable.
  const publishHeader = useRef<() => void>(() => undefined);
  publishHeader.current = () => {
    if (!team || isLoading) {
      return;
    }

    const canEdit = canEditAll || canEditDisplayName;

    onSetHeader?.({
      actions: buildHeaderActions(t, team, params),
      titleInput: buildTitleInput(
        t,
        isEditingName,
        editNameValue,
        onEditNameValueChange,
        onSaveDisplayName,
        onCancelEditName
      ),
      titleSuffix: buildTitleSuffix(
        t,
        team,
        canEdit,
        isEditingName,
        onStartEditName
      ),
    });
  };

  const clearHeader = useRef<() => void>(() => undefined);
  clearHeader.current = () =>
    onSetHeader?.({
      actions: undefined,
      titleInput: undefined,
      titleSuffix: undefined,
    });

  useEffect(() => {
    publishHeader.current();

    // The parent no longer clears header slots on view change (that raced the
    // child set), so clear what this hook owns when the team view unmounts.
    return () => clearHeader.current();
  }, [
    team,
    isLoading,
    isEditingName,
    editNameValue,
    canEditAll,
    canEditDisplayName,
    params.canDelete,
    params.canRestore,
    params.canCreateTeam,
    params.isGroupType,
    params.isOrgType,
    params.isCurrentUserMember,
  ]);
};

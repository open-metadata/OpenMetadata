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
  Trash01,
  Upload01,
} from '@openmetadata/ui-core-components/icons';
import { ReactNode, useEffect } from 'react';
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
        size="sm"
        onPress={onSaveDisplayName}>
        {t('label.save')}
      </Button>
      <Button
        color="tertiary"
        data-testid="cancel-display-name"
        size="sm"
        onPress={onCancelEditName}>
        {t('label.cancel')}
      </Button>
    </Box>
  ) : undefined;

const getJoinableLabel = (t: TranslateFn, team: Team): string =>
  team.isJoinable ? t('label.make-private') : t('label.make-public');

// The manage items (make public/private, restore, delete) split out to keep
// buildTeamActionsMenu's branching under the complexity budget.
const buildManageMenuItems = (
  t: TranslateFn,
  team: Team,
  params: UseMembersTeamHeaderParams
): ReactNode => {
  const {
    canDelete,
    canEditAll,
    canRestore,
    isOrgType,
    onToggleJoinable,
    onRestoreTeam,
    onDelete,
  } = params;
  const notDeleted = !team.deleted;
  // Can't restore into a deleted parent — mirrors the legacy team page.
  const parentDeleted = Boolean(team.parents?.[0]?.deleted);

  return (
    <>
      {!isOrgType && notDeleted && canEditAll && (
        <Dropdown.Item
          data-testid="toggle-joinable"
          icon={Lock01}
          onAction={onToggleJoinable}>
          {getJoinableLabel(t, team)}
        </Dropdown.Item>
      )}
      {team.deleted && canRestore && !parentDeleted && (
        <Dropdown.Item data-testid="restore-team" onAction={onRestoreTeam}>
          {t('label.restore-entity', {
            entity: t('label.team'),
          })}
        </Dropdown.Item>
      )}
      {canDelete && !isOrgType && (
        <Dropdown.Item
          data-testid="delete-team"
          icon={Trash01}
          onAction={onDelete}>
          {t('label.delete')}
        </Dropdown.Item>
      )}
    </>
  );
};

const buildTeamActionsMenu = (
  t: TranslateFn,
  team: Team,
  params: UseMembersTeamHeaderParams
): ReactNode => {
  const { canCreateTeam, isGroupType, onTeamExport, onTeamImport } = params;

  return (
    <Dropdown.Menu>
      {!isGroupType && !team.deleted && (
        <>
          <Dropdown.Item
            data-testid="export-team"
            icon={Download01}
            onAction={onTeamExport}>
            {t('label.export-entity', {
              entity: t('label.team'),
            })}
          </Dropdown.Item>
          {canCreateTeam && (
            <Dropdown.Item
              data-testid="import-team"
              icon={Upload01}
              onAction={onTeamImport}>
              {t('label.import-entity', {
                entity: t('label.team'),
              })}
            </Dropdown.Item>
          )}
        </>
      )}
      {buildManageMenuItems(t, team, params)}
    </Dropdown.Menu>
  );
};

const buildHeaderActions = (
  t: TranslateFn,
  team: Team,
  params: UseMembersTeamHeaderParams
): ReactNode => {
  const {
    canEditAll,
    isGroupType,
    isCurrentUserMember,
    onJoinTeam,
    onLeaveTeam,
  } = params;

  // A member can always leave; joining is only offered on joinable teams (admins
  // hold canEditAll, so they can still join a private team).
  const canJoinable = isCurrentUserMember || team.isJoinable || canEditAll;
  const showJoinLeave = isGroupType && !team.deleted && canJoinable;

  return (
    <Box align="center" direction="row" gap={2}>
      {showJoinLeave && (
        <Button
          color={isCurrentUserMember ? 'secondary' : 'primary'}
          data-testid={
            isCurrentUserMember ? 'leave-team-button' : 'join-team-button'
          }
          size="sm"
          onPress={isCurrentUserMember ? onLeaveTeam : onJoinTeam}>
          {isCurrentUserMember ? t('label.leave-team') : t('label.join-team')}
        </Button>
      )}
      <Dropdown.Root>
        <Dropdown.DotsButton />
        <Dropdown.Popover className="tw:w-min">
          {buildTeamActionsMenu(t, team, params)}
        </Dropdown.Popover>
      </Dropdown.Root>
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

  useEffect(() => {
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

    // The parent no longer clears header slots on view change (that raced the
    // child set), so clear what this hook owns when the team view unmounts.
    return () =>
      onSetHeader?.({
        actions: undefined,
        titleInput: undefined,
        titleSuffix: undefined,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    onSaveDisplayName,
    params.onTeamExport,
    params.onTeamImport,
    params.onToggleJoinable,
    params.onRestoreTeam,
    params.onJoinTeam,
    params.onLeaveTeam,
    onSetHeader,
    t,
  ]);
};

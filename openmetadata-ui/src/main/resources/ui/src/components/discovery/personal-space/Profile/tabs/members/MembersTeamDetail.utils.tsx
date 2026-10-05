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
    Button,
    ButtonUtility,
    Typography
} from '@openmetadata/ui-core-components';
import { Trash01 } from '@openmetadata/ui-core-components/icons';
import { TabSpecificField } from '../../../../../../enums/entity.enum';
import { Team, TeamType } from '../../../../../../generated/entity/teams/team';
import { User } from '../../../../../../generated/entity/teams/user';
import { EntityReference } from '../../../../../../generated/entity/type';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { LIST_CAP } from '../../../../../../utils/PermissionsUtils';
import RichTextEditorPreviewerV1 from '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import type { ColumnsType } from '../../../../../common/Table/Table.interface';
import type { MembersView } from './Members.types';
import type { TeamTab } from './MembersTeamDetail.types';
import { EntityLinksCell, UserNameCell } from './MembersUserColumns';
import { profileHash, ProfileHashTarget } from './profileHash.utils';

export const TEAM_FIELDS = [
  TabSpecificField.USERS,
  TabSpecificField.DEFAULT_ROLES,
  TabSpecificField.DEFAULT_PERSONA,
  TabSpecificField.POLICIES,
  TabSpecificField.PARENTS,
  TabSpecificField.CHILDREN_COUNT,
  TabSpecificField.USER_COUNT,
  TabSpecificField.OWNS,
  TabSpecificField.DOMAINS,
  TabSpecificField.OWNERS,
].join(',');

export const TEAM_USER_FIELDS = [
  TabSpecificField.ROLES,
  TabSpecificField.TEAMS,
  TabSpecificField.PROFILE,
].join(',');

export const TEAM_DRAG_TYPE = 'team-hierarchy-row';

export { LIST_CAP };

export const isTeamDropTarget = (target: {
  type: string;
  dropPosition?: string;
}): boolean =>
  target.type === 'root' ||
  (target.type === 'item' && target.dropPosition === 'on');

export const getAvailableTabs = (teamType?: TeamType): TeamTab[] => {
  switch (teamType) {
    case TeamType.Organization:
      return ['teams', 'roles', 'policies'];
    case TeamType.Group:
      return ['users', 'assets', 'roles', 'policies'];
    default:
      return ['teams', 'users', 'roles', 'policies'];
  }
};

export const getTabLabel = (
  tab: TeamTab,
  t: (key: string) => string,
  team: Team,
  childTeamsCount: number,
  assetCount: number
): string => {
  switch (tab) {
    case 'teams':
      return `${t('label.team-plural')} (${childTeamsCount})`;
    case 'users':
      return `${t('label.user-plural')} (${team.users?.length ?? 0})`;
    case 'assets':
      return `${t('label.asset-plural')} (${assetCount})`;
    case 'roles':
      return `${t('label.role-plural')} (${team.defaultRoles?.length ?? 0})`;
    default:
      return `${t('label.policy-plural')} (${team.policies?.length ?? 0})`;
  }
};

// The child-team table is a lazy-loaded tree: a row with sub-teams carries an
// empty `children` array (the expand placeholder TableV2 reads), a leaf carries
// none. On expand the row's real children replace that placeholder.
export const withTeamChildrenPlaceholder = (teams: Team[]): Team[] =>
  teams.map((team) => ({
    ...team,
    children:
      team.childrenCount && team.childrenCount > 0
        ? (team.children as EntityReference[] | undefined) ?? []
        : undefined,
  }));

// Walks the loaded tree and grafts a parent's freshly-fetched children in place
// (mutates `teams`; the caller passes a clone). Mirrors the legacy TeamsPage.
export const updateTeamsHierarchy = (
  teams: Team[],
  parentFqn: string,
  children: Team[]
): void => {
  for (const team of teams) {
    if (team.fullyQualifiedName === parentFqn) {
      team.children = children as unknown as EntityReference[];

      return;
    }
    if (team.children && team.children.length > 0) {
      updateTeamsHierarchy(
        team.children as unknown as Team[],
        parentFqn,
        children
      );
    }
  }
};

export const getChildTeamColumns = (
  t: (key: string, options?: Record<string, unknown>) => string,
  onNavigate: (view: MembersView) => void
): ColumnsType<Team> => [
  {
    title: t('label.team-plural'),
    dataIndex: 'name',
    key: 'name',
    width: '30%',
    render: (_: unknown, record: Team) => (
      <Button
        color="link-color"
        data-testid={`team-link-${record.name}`}
        size="sm"
        onPress={() =>
          onNavigate({
            type: 'team-detail',
            fqn: record.fullyQualifiedName ?? record.name,
            name: getEntityName(record),
          })
        }>
        {getEntityName(record)}
      </Button>
    ),
  },
  {
    title: t('label.type'),
    dataIndex: 'teamType',
    key: 'type',
  },
  {
    title: t('label.sub-team-plural'),
    dataIndex: 'childrenCount',
    key: 'subTeams',
    render: (count: number) => count ?? 0,
  },
  {
    title: t('label.user-plural'),
    dataIndex: 'userCount',
    key: 'users',
    render: (count: number) => count ?? 0,
  },
  {
    title: t('label.asset-plural'),
    dataIndex: 'owns',
    key: 'assets',
    render: (_: unknown, record: Team) => record.owns?.length ?? 0,
  },
  {
    title: t('label.description'),
    dataIndex: 'description',
    key: 'description',
    width: '30%',
    render: (desc: string) =>
      desc ? (
        <RichTextEditorPreviewerV1 markdown={desc} maxLength={120} />
      ) : (
        <Typography className="tw:text-tertiary" size="text-sm">
          {t('label.no-description')}
        </Typography>
      ),
  },
];

export const getUserColumns = (
  t: (key: string, options?: Record<string, unknown>) => string,
  canEditAll: boolean,
  goTo: (target: ProfileHashTarget) => void,
  onRemoveUser: (record: User) => void
): ColumnsType<User> => [
  {
    title: t('label.username'),
    dataIndex: 'name',
    key: 'username',
    ellipsis: true,
    render: (_: unknown, record: User) => (
      <UserNameCell goTo={goTo} record={record} />
    ),
  },
  {
    title: t('label.name'),
    dataIndex: 'displayName',
    key: 'name',
    ellipsis: true,
    render: (_: unknown, record: User) => (
      <Typography className="tw:truncate tw:block tw:max-w-full">
        {getEntityName(record)}
      </Typography>
    ),
  },
  {
    title: t('label.role-plural'),
    dataIndex: 'roles',
    key: 'roles',
    render: (_: unknown, record: User) => (
      <EntityLinksCell
        emptyLabel={t('label.no-entity', { entity: t('label.role') })}
        goTo={goTo}
        items={record.roles}
        targetFn={profileHash.role}
      />
    ),
  },
  ...(canEditAll
    ? [
        {
          title: t('label.action-plural'),
          dataIndex: 'actions',
          key: 'actions',
          width: 80,
          render: (_: unknown, record: User) => (
            <ButtonUtility
              color="tertiary"
              data-testid={`remove-user-${record.name}`}
              icon={Trash01}
              size="xs"
              tooltip={t('label.remove')}
              tooltipPlacement="left"
              onClick={() => onRemoveUser(record)}
            />
          ),
        },
      ]
    : []),
];

export const getEntityRefColumns = (
  t: (key: string, options?: Record<string, unknown>) => string,
  canEditAll: boolean,
  isSavingInline: boolean,
  goTo: (target: ProfileHashTarget) => void,
  onRemove: (ref: EntityReference) => void,
  nameHashOf: (ref: EntityReference) => ProfileHashTarget
): ColumnsType<EntityReference> => [
  {
    title: t('label.name'),
    dataIndex: 'name',
    key: 'name',
    render: (_: unknown, record: EntityReference) => (
      <Button
        color="link-color"
        size="sm"
        onPress={() => goTo(nameHashOf(record))}>
        {getEntityName(record)}
      </Button>
    ),
  },
  {
    title: t('label.description'),
    dataIndex: 'description',
    key: 'description',
    render: (_: unknown, record: EntityReference) => record.description || '--',
  },
  ...(canEditAll
    ? [
        {
          title: t('label.action-plural'),
          dataIndex: 'actions',
          key: 'actions',
          width: 80,
          render: (_: unknown, record: EntityReference) => (
            <ButtonUtility
              color="tertiary"
              data-testid={`remove-${getEntityName(record)}`}
              icon={Trash01}
              isDisabled={isSavingInline}
              size="xs"
              tooltip={t('label.remove')}
              tooltipPlacement="left"
              onClick={() => onRemove(record)}
            />
          ),
        },
      ]
    : []),
];

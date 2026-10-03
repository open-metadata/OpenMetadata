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
  Autocomplete,
  Box,
  Button,
  ButtonUtility,
  Card,
  Dialog,
  Dropdown,
  EmptyPlaceholder,
  FeaturedIcon,
  Input,
  Modal,
  ModalOverlay,
  PaginationCardWithControls,
  SelectItemType,
  Tabs,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowRight,
  Download01,
  Edit01,
  Lock01,
  Trash01,
  Upload01,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFilter } from 'react-aria';
import type { Key } from 'react-aria-components';
import { DropZone, useDragAndDrop } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as ColumnDragIcon } from '../../../../../../assets/svg/menu-duo.svg';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
  ROUTES,
} from '../../../../../../constants/constants';
import { ExportTypes } from '../../../../../../constants/Export.constants';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { AssetsOfEntity } from '../../../../../../enums/Assets.enum';
import {
  EntityType,
  TabSpecificField,
} from '../../../../../../enums/entity.enum';
import { CursorType } from '../../../../../../enums/pagination.enum';
import { SearchIndex } from '../../../../../../enums/search.enum';
import {
  Operation,
  Policy,
} from '../../../../../../generated/entity/policies/policy';
import { Role } from '../../../../../../generated/entity/teams/role';
import { Team, TeamType } from '../../../../../../generated/entity/teams/team';
import { User } from '../../../../../../generated/entity/teams/user';
import { EntityReference } from '../../../../../../generated/entity/type';
import { Include } from '../../../../../../generated/type/include';
import { usePaging } from '../../../../../../hooks/paging/usePaging';
import { useApplicationStore } from '../../../../../../hooks/useApplicationStore';
import { useEntityPermissions } from '../../../../../../hooks/useEntityPermissions/useEntityPermissions';
import { usePersonalSpaceStore } from '../../../../../../hooks/usePersonalSpaceStore';
import { useSettingsHash } from '../../../../../../hooks/useSettingsHash';
import { getPolicies, getRoles } from '../../../../../../rest/rolesAPIV1';
import { searchQuery } from '../../../../../../rest/searchAPI';
import {
  deleteUserFromTeam,
  exportTeam,
  exportUserOfTeam,
  getTeamByName,
  getTeams,
  patchTeamDetail,
  restoreTeam,
} from '../../../../../../rest/teamsAPI';
import { getUsers } from '../../../../../../rest/userAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { Transi18next } from '../../../../../../utils/i18next/LocalUtil';
import {
  checkPermission,
  LIST_CAP,
} from '../../../../../../utils/PermissionsUtils';
import { getTermQuery } from '../../../../../../utils/SearchPureUtils';
import { isDropRestricted } from '../../../../../../utils/TeamUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import withSuspenseFallback from '../../../../../AppRouter/withSuspenseFallback';
import DeleteModal from '../../../../../common/DeleteModal/DeleteModal';
import DeleteEntityModal from '../../../../../common/DeleteWidget/DeleteEntityModal';
import Loader from '../../../../../common/Loader/Loader';
import UserPopOverCard from '../../../../../common/PopOverCard/UserPopOverCard';
import RichTextEditor from '../../../../../common/RichTextEditor/RichTextEditor';
import { EditorContentRef } from '../../../../../common/RichTextEditor/RichTextEditor.interface';
import RichTextEditorPreviewerV1 from '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import type { ColumnsType } from '../../../../../common/Table/Table.interface';
import Table from '../../../../../common/Table/TableV2';
import { UserTeamSelectableList } from '../../../../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import { useEntityExportModalProvider } from '../../../../../Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import type { EntityDetailsObjectInterface } from '../../../../../Explore/ExplorePage.interface';
import type { MembersTeamDetailProps } from './Members.types';
import MembersTeamInfoWidgets from './MembersTeamInfoWidgets';
import {
  profileHash,
  ProfileHashTarget,
  toHashLocation,
} from './profileHash.utils';

const AssetsTabs = withSuspenseFallback(
  React.lazy(
    () =>
      import('../../../../../Glossary/GlossaryTerms/tabs/AssetsTabs.component')
  )
);

const EntitySummaryPanel = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../../../../Explore/EntitySummaryPanel/EntitySummaryPanel.component'
      )
  )
);

type TeamTab = 'teams' | 'users' | 'assets' | 'roles' | 'policies';

const TEAM_FIELDS = [
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

const TEAM_USER_FIELDS = [
  TabSpecificField.ROLES,
  TabSpecificField.TEAMS,
  TabSpecificField.PROFILE,
].join(',');

const TEAM_DRAG_TYPE = 'team-hierarchy-row';

const isTeamDropTarget = (target: {
  type: string;
  dropPosition?: string;
}): boolean =>
  target.type === 'root' ||
  (target.type === 'item' && target.dropPosition === 'on');

const getAvailableTabs = (teamType?: TeamType): TeamTab[] => {
  switch (teamType) {
    case TeamType.Organization:
      return ['teams', 'roles', 'policies'];
    case TeamType.Group:
      return ['users', 'assets', 'roles', 'policies'];
    default:
      return ['teams', 'users', 'roles', 'policies'];
  }
};

const getTabLabel = (
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

const MembersTeamDetail: FC<MembersTeamDetailProps> = ({
  fqn,
  onNavigate,
  onRename,
  onSetHeaderActions,
  onSetHeaderTitleInput,
  onSetHeaderTitleSuffix,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { permissions: globalPermissions } = usePermissionProvider();
  const { showModal } = useEntityExportModalProvider();
  const { currentUser } = useApplicationStore();
  const closePersonalSpace = usePersonalSpaceStore((state) => state.close);
  const { setHash } = useSettingsHash();

  // location.hash-driven (href) navigation is starved by this panel's streaming
  // header updates, so cross-tab links must write the hash synchronously.
  const goTo = useCallback(
    (target: ProfileHashTarget) => setHash(target.tab, target.subPath),
    [setHash]
  );

  const [team, setTeam] = useState<Team>();
  const [childTeams, setChildTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChildTeamsLoading, setIsChildTeamsLoading] = useState(false);
  const [showDeletedTeam, setShowDeletedTeam] = useState(false);
  const [activeTab, setActiveTab] = useState<TeamTab>('teams');
  const [assetCount, setAssetCount] = useState(0);
  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [usersSearchTerm, setUsersSearchTerm] = useState('');
  const [isTableHovered, setIsTableHovered] = useState(false);
  const [movedTeam, setMovedTeam] = useState<{
    from: Team;
    to?: Team;
  }>();
  const draggedTeamRef = useRef<Team>();

  // Inline add role/policy
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [selectedNewRoles, setSelectedNewRoles] = useState<string[]>([]);

  const [isAddingPolicy, setIsAddingPolicy] = useState(false);
  const [availablePolicies, setAvailablePolicies] = useState<Policy[]>([]);
  const [selectedNewPolicies, setSelectedNewPolicies] = useState<string[]>([]);

  const [isSavingInline, setIsSavingInline] = useState(false);
  const { contains } = useFilter({ sensitivity: 'base' });

  // Adding users

  // Inline description edit
  const [isDescEditing, setIsDescEditing] = useState(false);
  const [isDescSaving, setIsDescSaving] = useState(false);
  const descEditorRef = useRef<EditorContentRef>(null);

  // Remove confirmation (user / role / policy)
  const [removeEntity, setRemoveEntity] = useState<{
    ref: EntityReference;
    kind: 'user' | 'role' | 'policy';
  }>();

  // Team users tab (full user objects with roles)
  const [teamUsers, setTeamUsers] = useState<User[]>([]);
  const [isTeamUsersLoading, setIsTeamUsersLoading] = useState(false);
  const {
    currentPage: usersPage,
    handlePageChange: handleUsersPageChange,
    handlePagingChange: handleUsersPagingChange,
    handlePageSizeChange: handleUsersPageSizeChange,
    pageSize: usersPageSize,
    paging: usersPaging,
    showPagination: showUsersPagination,
  } = usePaging();

  const { canEditAll, canEditDescription, canEditDisplayName, permissions } =
    useEntityPermissions(ResourceEntity.TEAM, fqn, {
      deleted: team?.deleted,
      enabled: Boolean(fqn),
    });

  const canCreateTeam = useMemo(
    () =>
      !isEmpty(globalPermissions) &&
      checkPermission(Operation.Create, ResourceEntity.TEAM, globalPermissions),
    [globalPermissions]
  );

  const canDelete = useMemo(
    () =>
      !isEmpty(globalPermissions) &&
      checkPermission(Operation.Delete, ResourceEntity.TEAM, globalPermissions),
    [globalPermissions]
  );

  const isOrgType = team?.teamType === TeamType.Organization;
  const isGroupType = team?.teamType === TeamType.Group;

  const isCurrentUserMember = useMemo(() => {
    if (!currentUser || !team?.users) {
      return false;
    }

    return team.users.some((u) => u.id === currentUser.id);
  }, [currentUser, team?.users]);

  const fetchTeam = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getTeamByName(fqn, {
        fields: TEAM_FIELDS,
        include: Include.All,
      });
      setTeam(data);
      const tabs = getAvailableTabs(data.teamType);
      if (!tabs.includes(activeTab)) {
        setActiveTab(tabs[0]);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [fqn]);

  const fetchChildTeams = useCallback(async () => {
    if (!team?.fullyQualifiedName) {
      return;
    }
    setIsChildTeamsLoading(true);
    try {
      const { data } = await getTeams({
        parentTeam: team.fullyQualifiedName,
        include: showDeletedTeam ? Include.Deleted : Include.NonDeleted,
        fields: [
          TabSpecificField.USER_COUNT,
          TabSpecificField.CHILDREN_COUNT,
          TabSpecificField.OWNS,
          TabSpecificField.PARENTS,
        ],
      });
      setChildTeams(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setChildTeams([]);
    } finally {
      setIsChildTeamsLoading(false);
    }
  }, [team?.fullyQualifiedName, showDeletedTeam]);

  const fetchTeamUsers = useCallback(
    async (params?: { after?: string; before?: string }) => {
      if (!team?.name) {
        return;
      }
      setIsTeamUsersLoading(true);
      try {
        const response = await getUsers({
          fields: TEAM_USER_FIELDS,
          team: team.name,
          limit: usersPageSize,
          isBot: false,
          ...params,
        });
        setTeamUsers(response.data);
        handleUsersPagingChange(response.paging);
      } catch (error) {
        showErrorToast(error as AxiosError);
        setTeamUsers([]);
      } finally {
        setIsTeamUsersLoading(false);
      }
    },
    [team?.name, usersPageSize, handleUsersPagingChange]
  );

  const handleTeamUsersPageNavigation = (newPage: number) => {
    if (newPage === usersPage) {
      return;
    }

    // ponytail: cursor paging only supports ±1 steps; numbered/jump beyond adjacent no-ops.
    const cursorType =
      newPage > usersPage ? CursorType.AFTER : CursorType.BEFORE;
    const cursor = usersPaging[cursorType];

    if (Math.abs(newPage - usersPage) !== 1 || !cursor) {
      return;
    }

    handleUsersPageChange(newPage);
    fetchTeamUsers({ [cursorType]: cursor });
  };

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  useEffect(() => {
    if (team) {
      fetchChildTeams();
    }
  }, [team?.fullyQualifiedName, showDeletedTeam]);

  useEffect(() => {
    if (team && activeTab === 'users') {
      fetchTeamUsers();
    }
  }, [team?.fullyQualifiedName, activeTab, usersPageSize]);

  const handlePatchTeam = useCallback(
    async (updatedTeam: Team) => {
      if (!team) {
        return;
      }
      const patch = compare(team, updatedTeam);
      if (patch.length === 0) {
        return;
      }
      try {
        const res = await patchTeamDetail(team.id, patch);
        setTeam(res);
        showSuccessToast(
          t('server.update-entity-success', { entity: t('label.team') })
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [team, t]
  );

  const handleDescriptionSave = useCallback(async () => {
    if (!team) {
      return;
    }
    const value = descEditorRef.current?.getEditorContent() ?? '';
    setIsDescSaving(true);
    try {
      await handlePatchTeam({ ...team, description: value });
      setIsDescEditing(false);
    } finally {
      setIsDescSaving(false);
    }
  }, [team, handlePatchTeam]);

  const handleSaveDisplayName = useCallback(() => {
    if (!team) {
      return;
    }
    const trimmed = editNameValue.trim();
    handlePatchTeam({ ...team, displayName: trimmed });
    onRename?.(trimmed || team.name);
    setIsEditingName(false);
  }, [team, editNameValue, handlePatchTeam, onRename]);

  const handleRestoreTeam = useCallback(async () => {
    if (!team) {
      return;
    }
    try {
      const restored = await restoreTeam(team.id);
      setTeam(restored);
      showSuccessToast(
        t('server.restore-entity-success', { entity: t('label.team') })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [team, t]);

  const handleToggleJoinable = useCallback(() => {
    if (!team) {
      return;
    }
    handlePatchTeam({ ...team, isJoinable: !team.isJoinable });
  }, [team, handlePatchTeam]);

  const handleJoinTeam = useCallback(async () => {
    if (!team || !currentUser) {
      return;
    }
    const currentTeams = currentUser.teams ?? [];
    const updatedUser = {
      ...currentUser,
      teams: [
        ...currentTeams,
        { id: team.id, type: EntityType.TEAM } as EntityReference,
      ],
    };
    try {
      const patch = compare(currentUser, updatedUser);
      const { updateUserDetail } = await import(
        '../../../../../../rest/userAPI'
      );
      await updateUserDetail(currentUser.id, patch);
      showSuccessToast(
        t('server.join-team-success', { team: getEntityName(team) })
      );
      fetchTeam();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [team, currentUser, t, fetchTeam]);

  const handleLeaveTeam = useCallback(async () => {
    if (!team || !currentUser) {
      return;
    }
    try {
      await deleteUserFromTeam(team.id, currentUser.id);
      showSuccessToast(
        t('server.leave-team-success', { team: getEntityName(team) })
      );
      fetchTeam();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [team, currentUser, t, fetchTeam]);

  const handleTeamExport = useCallback(() => {
    if (!team?.name) {
      return;
    }
    showModal({
      name: team.name,
      exportTypes: [ExportTypes.CSV],
      onExport: (name) => exportTeam(name),
    });
  }, [team, showModal]);

  const handleTeamImport = useCallback(() => {
    if (team?.name) {
      onNavigate({ type: 'teams-import', fqn: team.name, importType: 'teams' });
    }
  }, [team, onNavigate]);

  const handleUsersExport = useCallback(() => {
    if (!team?.name) {
      return;
    }
    showModal({
      name: team.name,
      exportTypes: [ExportTypes.CSV],
      onExport: (name) => exportUserOfTeam(name),
    });
  }, [team, showModal]);

  const handleRemoveUser = useCallback(
    async (userId: string) => {
      if (!team) {
        return;
      }
      try {
        await deleteUserFromTeam(team.id, userId);
        showSuccessToast(
          t('server.update-entity-success', { entity: t('label.team') })
        );
        fetchTeam();
        fetchTeamUsers();
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [team, t, fetchTeam, fetchTeamUsers]
  );

  const handleAddUsers = useCallback(
    // The selectable-list popover returns the full updated member set (seeded
    // with team.users), so replace rather than append.
    async (users: EntityReference[]) => {
      if (!team) {
        return;
      }
      await handlePatchTeam({ ...team, users });
      fetchTeamUsers();
    },
    [team, handlePatchTeam, fetchTeamUsers]
  );

  const handleStartAddRole = useCallback(async () => {
    setIsAddingRole(true);
    try {
      const data = await getRoles('', undefined, undefined, false, 100);
      const existingIds = new Set((team?.defaultRoles ?? []).map((r) => r.id));
      setAvailableRoles(
        (data.data ?? []).filter((r) => !existingIds.has(r.id))
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [team]);

  const handleConfirmAddRoles = useCallback(async () => {
    if (!team || selectedNewRoles.length === 0) {
      return;
    }
    const newRefs = selectedNewRoles
      .map((fqnOrName) => {
        const r = availableRoles.find(
          (ar) => ar.fullyQualifiedName === fqnOrName || ar.name === fqnOrName
        );

        return r
          ? ({
              id: r.id,
              type: 'role',
              fullyQualifiedName: r.fullyQualifiedName,
              name: r.name,
            } as EntityReference)
          : null;
      })
      .filter(Boolean) as EntityReference[];
    const updated = {
      ...team,
      defaultRoles: [...(team.defaultRoles ?? []), ...newRefs],
    };
    setIsSavingInline(true);
    try {
      const patch = compare(team, updated);
      await patchTeamDetail(team.id, patch);
      setTeam(updated);
      setIsAddingRole(false);
      setSelectedNewRoles([]);
      showSuccessToast(
        t('server.update-entity-success', { entity: t('label.team') })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSavingInline(false);
    }
  }, [team, selectedNewRoles, availableRoles, t]);

  const handleStartAddPolicy = useCallback(async () => {
    setIsAddingPolicy(true);
    try {
      const data = await getPolicies('', undefined, undefined, 100);
      const existingIds = new Set((team?.policies ?? []).map((p) => p.id));
      setAvailablePolicies(
        (data.data ?? []).filter((p) => !existingIds.has(p.id))
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [team]);

  const handleConfirmAddPolicies = useCallback(async () => {
    if (!team || selectedNewPolicies.length === 0) {
      return;
    }
    const newRefs = selectedNewPolicies
      .map((fqnOrName) => {
        const p = availablePolicies.find(
          (ap) => ap.fullyQualifiedName === fqnOrName || ap.name === fqnOrName
        );

        return p
          ? ({
              id: p.id,
              type: 'policy',
              fullyQualifiedName: p.fullyQualifiedName,
              name: p.name,
            } as EntityReference)
          : null;
      })
      .filter(Boolean) as EntityReference[];
    const updated = {
      ...team,
      policies: [...(team.policies ?? []), ...newRefs],
    };
    setIsSavingInline(true);
    try {
      const patch = compare(team, updated);
      await patchTeamDetail(team.id, patch);
      setTeam(updated);
      setIsAddingPolicy(false);
      setSelectedNewPolicies([]);
      showSuccessToast(
        t('server.update-entity-success', { entity: t('label.team') })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSavingInline(false);
    }
  }, [team, selectedNewPolicies, availablePolicies, t]);

  const handleMoveConfirm = useCallback(async () => {
    if (!movedTeam?.from || !team) {
      return;
    }
    const dropTeamId = movedTeam.to?.id;
    try {
      // Match the legacy move: fetch the dragged team with its full child-bearing
      // field set so the patch diff is limited to `parents`, then re-parent
      // (undefined parents === move to the organization root).
      const data = await getTeamByName(movedTeam.from.name, {
        fields: [
          TabSpecificField.USERS,
          TabSpecificField.DEFAULT_ROLES,
          TabSpecificField.POLICIES,
          TabSpecificField.OWNERS,
          TabSpecificField.PARENTS,
          TabSpecificField.CHILDREN,
        ],
        include: Include.All,
      });
      const updatedTeam: Team = {
        ...data,
        parents: dropTeamId
          ? [{ id: dropTeamId, type: EntityType.TEAM }]
          : undefined,
      };
      const patch = compare(data, updatedTeam);
      await patchTeamDetail(data.id, patch);
      showSuccessToast(t('message.team-moved-success'));
      fetchChildTeams();
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.team-moved-error'));
    } finally {
      setMovedTeam(undefined);
    }
  }, [movedTeam, team, t, fetchChildTeams]);

  // DnD hooks for the team hierarchy table
  const teamByName = useMemo(() => {
    const map = new Map<string, Team>();
    childTeams.forEach((ct) => map.set(ct.fullyQualifiedName ?? ct.name, ct));

    return map;
  }, [childTeams]);

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => {
      const record = teamByName.get(String(Array.from(keys)[0]));

      return record ? [{ [TEAM_DRAG_TYPE]: record.name }] : [];
    },
    acceptedDragTypes: [TEAM_DRAG_TYPE],
    onDragStart: (event) => {
      draggedTeamRef.current = teamByName.get(
        String(Array.from(event.keys)[0])
      );
      setIsTableHovered(true);
    },
    onDragEnd: () => {
      draggedTeamRef.current = undefined;
      setIsTableHovered(false);
    },
    getDropOperation: (target, types) =>
      types.has(TEAM_DRAG_TYPE) && isTeamDropTarget(target) ? 'move' : 'cancel',
    onItemDrop: (event) => {
      const dragRecord = draggedTeamRef.current;
      const targetRecord = teamByName.get(String(event.target.key));
      draggedTeamRef.current = undefined;
      if (!dragRecord || !targetRecord || dragRecord.id === targetRecord.id) {
        return;
      }
      if (isDropRestricted(dragRecord.teamType, targetRecord.teamType)) {
        showErrorToast(
          t('message.error-team-transfer-message', {
            dragTeam: dragRecord.teamType,
            dropTeam: targetRecord.teamType,
          })
        );

        return;
      }
      setMovedTeam({ from: dragRecord, to: targetRecord });
    },
    onRootDrop: () => {
      if (draggedTeamRef.current) {
        setMovedTeam({ from: draggedTeamRef.current, to: undefined });
      }
    },
  });

  // Child team columns
  const childTeamColumns: ColumnsType<Team> = useMemo(
    () => [
      {
        title: '',
        dataIndex: 'drag',
        key: 'drag',
        width: 32,
        render: () => (
          <ColumnDragIcon
            aria-hidden
            className="tw:size-4 tw:text-tertiary tw:cursor-grab"
            data-testid="drag-handle"
          />
        ),
      },
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
    ],
    [t, onNavigate]
  );

  const userColumns: ColumnsType<User> = useMemo(
    () => [
      {
        title: t('label.username'),
        dataIndex: 'name',
        key: 'username',
        ellipsis: true,
        render: (_: unknown, record: User) =>
          record.name ? (
            <UserPopOverCard
              showUserName
              profileWidth={16}
              to={toHashLocation(profileHash.user(record.name))}
              userName={record.name}
              onTitleClick={() => goTo(profileHash.user(record.name ?? ''))}
            />
          ) : (
            getEntityName(record)
          ),
      },
      {
        title: t('label.name'),
        dataIndex: 'displayName',
        key: 'name',
        ellipsis: true,
        render: (_: unknown, record: User) => (
          <span className="tw:truncate tw:block tw:max-w-full">
            {getEntityName(record)}
          </span>
        ),
      },
      {
        title: t('label.role-plural'),
        dataIndex: 'roles',
        key: 'roles',
        render: (_: unknown, record: User) => {
          const roles = record.roles ?? [];
          if (roles.length === 0) {
            return t('label.no-entity', { entity: t('label.role') });
          }
          const visible = roles.slice(0, LIST_CAP);
          const overflow = roles.length - LIST_CAP;

          return (
            <Box align="center" direction="row" gap={1}>
              {visible.map((role) => (
                <Button
                  color="link-color"
                  key={role.id}
                  size="sm"
                  onPress={() =>
                    goTo(profileHash.role(role.fullyQualifiedName ?? ''))
                  }>
                  {getEntityName(role)}
                </Button>
              ))}
              {overflow > 0 && (
                <span
                  className="tw:text-xs tw:text-tertiary"
                  data-testid="plus-more-count">
                  {`+${overflow} ${t('label.more')}`}
                </span>
              )}
            </Box>
          );
        },
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
                  onClick={() =>
                    setRemoveEntity({
                      ref: record as unknown as EntityReference,
                      kind: 'user',
                    })
                  }
                />
              ),
            },
          ]
        : []),
    ],
    [t, canEditAll, goTo]
  );

  const handleRemoveRole = useCallback(
    async (roleRef: EntityReference) => {
      if (!team) {
        return;
      }
      const updated = {
        ...team,
        defaultRoles: (team.defaultRoles ?? []).filter(
          (r) => r.id !== roleRef.id
        ),
      };
      setIsSavingInline(true);
      try {
        await patchTeamDetail(team.id, compare(team, updated));
        setTeam(updated);
        showSuccessToast(
          t('server.update-entity-success', { entity: t('label.team') })
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsSavingInline(false);
      }
    },
    [team, t]
  );

  const handleRemovePolicy = useCallback(
    async (policyRef: EntityReference) => {
      if (!team) {
        return;
      }
      const updated = {
        ...team,
        policies: (team.policies ?? []).filter((p) => p.id !== policyRef.id),
      };
      setIsSavingInline(true);
      try {
        await patchTeamDetail(team.id, compare(team, updated));
        setTeam(updated);
        showSuccessToast(
          t('server.update-entity-success', { entity: t('label.team') })
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsSavingInline(false);
      }
    },
    [team, t]
  );

  const handleConfirmRemove = useCallback(async () => {
    if (!removeEntity) {
      return;
    }
    const { ref, kind } = removeEntity;
    if (kind === 'user') {
      await handleRemoveUser(ref.id);
    } else if (kind === 'role') {
      await handleRemoveRole(ref);
    } else {
      await handleRemovePolicy(ref);
    }
    setRemoveEntity(undefined);
  }, [removeEntity, handleRemoveUser, handleRemoveRole, handleRemovePolicy]);

  const makeEntityColumns = useCallback(
    (
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
        render: (_: unknown, record: EntityReference) =>
          record.description || '--',
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
    ],
    [t, canEditAll, isSavingInline, goTo]
  );

  const roleColumns = useMemo(
    () =>
      makeEntityColumns(
        (ref) => setRemoveEntity({ ref, kind: 'role' }),
        (ref) => profileHash.role(ref.fullyQualifiedName ?? ref.name ?? '')
      ),
    [makeEntityColumns]
  );

  const policyColumns = useMemo(
    () =>
      makeEntityColumns(
        (ref) => setRemoveEntity({ ref, kind: 'policy' }),
        (ref) => profileHash.policy(ref.fullyQualifiedName ?? ref.name ?? '')
      ),
    [makeEntityColumns]
  );

  const availableTabs = useMemo(
    () => getAvailableTabs(team?.teamType),
    [team?.teamType]
  );

  const filteredChildTeams = useMemo(() => {
    if (!searchTerm) {
      return childTeams;
    }
    const lower = searchTerm.toLowerCase();

    return childTeams.filter(
      (ct) =>
        ct.name.toLowerCase().includes(lower) ||
        getEntityName(ct).toLowerCase().includes(lower)
    );
  }, [childTeams, searchTerm]);

  const filteredTeamUsers = useMemo(() => {
    if (!usersSearchTerm) {
      return teamUsers;
    }
    const lower = usersSearchTerm.toLowerCase();

    return teamUsers.filter(
      (u) =>
        (u.name ?? '').toLowerCase().includes(lower) ||
        getEntityName(u).toLowerCase().includes(lower)
    );
  }, [teamUsers, usersSearchTerm]);

  const roleItems = useMemo<SelectItemType[]>(
    () =>
      availableRoles.map((r) => ({
        id: r.fullyQualifiedName ?? r.name,
        label: r.displayName || r.name,
      })),
    [availableRoles]
  );

  const policyItems = useMemo<SelectItemType[]>(
    () =>
      availablePolicies.map((p) => ({
        id: p.fullyQualifiedName ?? p.name,
        label: p.displayName || p.name,
      })),
    [availablePolicies]
  );

  // Match the legacy team assets query (TeamDetailsV1): AssetsTabs expects the
  // getTermQuery shape, and tableColumn hits must be excluded.
  const assetsQueryFilter = useMemo(
    () =>
      getTermQuery({ 'owners.id': team?.id ?? '' }, 'must', undefined, {
        mustNotTerms: { entityType: ['tableColumn'] },
      }),
    [team?.id]
  );

  // Asset tab count: owns is a truncated relationship list, so match the legacy
  // team page and read the real total from a search aggregation.
  const fetchAssetCount = useCallback(async () => {
    if (!team?.id || !isGroupType) {
      return;
    }
    try {
      const res = await searchQuery({
        query: '',
        pageNumber: 0,
        pageSize: 0,
        queryFilter: assetsQueryFilter,
        searchIndex: SearchIndex.ALL,
      });
      setAssetCount(res?.hits?.total.value ?? 0);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [team?.id, isGroupType, assetsQueryFilter]);

  useEffect(() => {
    fetchAssetCount();
  }, [fetchAssetCount]);

  // Header: edit name pencil + actions dropdown
  useEffect(() => {
    if (!team || isLoading) {
      return;
    }

    const canEdit = canEditAll || canEditDisplayName;

    onSetHeaderTitleSuffix?.(
      canEdit && !isEditingName ? (
        <ButtonUtility
          aria-label={t('label.edit-entity', {
            entity: t('label.display-name'),
          })}
          color="tertiary"
          data-testid="edit-display-name"
          icon={Edit01}
          size="xs"
          onClick={() => {
            setEditNameValue(getEntityName(team));
            setIsEditingName(true);
          }}
        />
      ) : undefined
    );

    onSetHeaderTitleInput?.(
      isEditingName ? (
        <Box align="center" direction="row" gap={2}>
          <Input
            data-testid="display-name-input"
            size="sm"
            value={editNameValue}
            onChange={(value) => setEditNameValue(value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSaveDisplayName();
              } else if (e.key === 'Escape') {
                setIsEditingName(false);
              }
            }}
          />
          <Button
            color="primary"
            data-testid="save-display-name"
            size="sm"
            onPress={handleSaveDisplayName}>
            {t('label.save')}
          </Button>
          <Button
            color="tertiary"
            data-testid="cancel-display-name"
            size="sm"
            onPress={() => setIsEditingName(false)}>
            {t('label.cancel')}
          </Button>
        </Box>
      ) : undefined
    );

    const headerActions = (
      <Box align="center" direction="row" gap={2}>
        {isGroupType && !team.deleted && (
          <Button
            color={isCurrentUserMember ? 'secondary' : 'primary'}
            data-testid={
              isCurrentUserMember ? 'leave-team-button' : 'join-team-button'
            }
            size="sm"
            onPress={isCurrentUserMember ? handleLeaveTeam : handleJoinTeam}>
            {isCurrentUserMember ? t('label.leave-team') : t('label.join-team')}
          </Button>
        )}
        <Dropdown.Root>
          <Dropdown.DotsButton />
          <Dropdown.Popover className="tw:w-min">
            <Dropdown.Menu>
              {!isGroupType && !team.deleted && (
                <>
                  <Dropdown.Item
                    data-testid="export-team"
                    icon={Download01}
                    onAction={handleTeamExport}>
                    {t('label.export-entity', {
                      entity: t('label.team'),
                    })}
                  </Dropdown.Item>
                  {canCreateTeam && (
                    <Dropdown.Item
                      data-testid="import-team"
                      icon={Upload01}
                      onAction={handleTeamImport}>
                      {t('label.import-entity', {
                        entity: t('label.team'),
                      })}
                    </Dropdown.Item>
                  )}
                </>
              )}
              {!isOrgType && !team.deleted && (
                <Dropdown.Item
                  data-testid="toggle-joinable"
                  icon={Lock01}
                  onAction={handleToggleJoinable}>
                  {team.isJoinable
                    ? t('label.make-private')
                    : t('label.make-public')}
                </Dropdown.Item>
              )}
              {team.deleted && (
                <Dropdown.Item
                  data-testid="restore-team"
                  onAction={handleRestoreTeam}>
                  {t('label.restore-entity', {
                    entity: t('label.team'),
                  })}
                </Dropdown.Item>
              )}
              {canDelete && !team.deleted && !isOrgType && (
                <Dropdown.Item
                  data-testid="delete-team"
                  icon={Trash01}
                  onAction={() => setIsDeleting(true)}>
                  {t('label.delete')}
                </Dropdown.Item>
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      </Box>
    );

    onSetHeaderActions?.(headerActions);
  }, [
    team,
    isLoading,
    isEditingName,
    editNameValue,
    canEditAll,
    canEditDisplayName,
    canDelete,
    canCreateTeam,
    isGroupType,
    isOrgType,
    isCurrentUserMember,
    handleSaveDisplayName,
    handleTeamExport,
    handleTeamImport,
    handleToggleJoinable,
    handleRestoreTeam,
    handleJoinTeam,
    handleLeaveTeam,
    onSetHeaderActions,
    onSetHeaderTitleInput,
    onSetHeaderTitleSuffix,
    t,
  ]);

  if (isLoading) {
    return <Loader />;
  }

  if (!team) {
    return null;
  }

  const canEditDescInline = (canEditAll || canEditDescription) && !team.deleted;

  return (
    <Box
      className="tw:flex-1 tw:overflow-y-auto"
      data-testid="team-detail"
      direction="col">
      {/* Info widget section */}
      <MembersTeamInfoWidgets
        canEdit={canEditAll && !team.deleted}
        team={team}
        onPatch={handlePatchTeam}
      />

      {/* Description (inline editor — no modal) */}
      <Card className="tw:mx-8 tw:mb-6">
        <Card.Content className="tw:px-3">
          <Box direction="col" gap={2}>
            <Box align="center" direction="row" gap={2}>
              <Typography className="tw:text-primary" weight="medium">
                {t('label.description')}
              </Typography>
              {canEditDescInline && !isDescEditing && (
                <ButtonUtility
                  color="tertiary"
                  data-testid="edit-description-btn"
                  icon={Edit01}
                  size="xs"
                  tooltip={String(
                    t('label.edit-entity', { entity: t('label.description') })
                  )}
                  tooltipPlacement="right"
                  onClick={() => setIsDescEditing(true)}
                />
              )}
            </Box>
            {isDescEditing && (
              <Box direction="col" gap={2}>
                <RichTextEditor
                  className="new-form-style"
                  initialValue={team.description ?? ''}
                  ref={descEditorRef}
                />
                <Box direction="row" gap={2} justify="end">
                  <Button
                    color="tertiary"
                    data-testid="cancel-description"
                    isDisabled={isDescSaving}
                    size="sm"
                    onPress={() => setIsDescEditing(false)}>
                    {t('label.cancel')}
                  </Button>
                  <Button
                    color="primary"
                    data-testid="save-description"
                    isLoading={isDescSaving}
                    size="sm"
                    onPress={handleDescriptionSave}>
                    {t('label.save')}
                  </Button>
                </Box>
              </Box>
            )}
            {!isDescEditing && team.description && (
              <RichTextEditorPreviewerV1 markdown={team.description} />
            )}
            {!isDescEditing && !team.description && (
              <Typography className="tw:text-tertiary" size="text-sm">
                {t('label.no-description')}
              </Typography>
            )}
          </Box>
        </Card.Content>
      </Card>

      {/* Tabs */}
      <Box className="tw:px-8 tw:flex-1" direction="col">
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key: Key) => setActiveTab(key as TeamTab)}>
          <Tabs.List size="sm" type="underline">
            {availableTabs.map((tab) => (
              <Tabs.Item id={tab} key={tab}>
                {getTabLabel(tab, t, team, childTeams.length, assetCount)}
              </Tabs.Item>
            ))}
          </Tabs.List>
        </Tabs>

        <Box className="tw:flex-1 tw:min-h-0 tw:overflow-auto tw:py-4">
          {/* Teams tab */}
          {activeTab === 'teams' && (
            <>
              <DropZone
                aria-label={t('label.move-entity-to-root', {
                  entity: t('label.team'),
                })}
                className="tw:block"
                getDropOperation={(types) =>
                  types.has(TEAM_DRAG_TYPE) ? 'move' : 'cancel'
                }
                onDrop={() => {
                  if (draggedTeamRef.current) {
                    setMovedTeam({
                      from: draggedTeamRef.current,
                      to: undefined,
                    });
                  }
                }}>
                <Table
                  className={isTableHovered ? 'drop-over-table' : undefined}
                  columns={childTeamColumns}
                  containerClassName="tw:rounded-xl"
                  data-testid="sub-teams-table"
                  dataSource={filteredChildTeams}
                  dragAndDropHooks={dragAndDropHooks}
                  extraTableFilters={
                    <Box align="center" direction="row" gap={3}>
                      <Toggle
                        data-testid="show-deleted-teams"
                        isSelected={showDeletedTeam}
                        label={t('label.deleted')}
                        size="sm"
                        onChange={setShowDeletedTeam}
                      />
                      {canCreateTeam && (
                        <Button
                          color="primary"
                          data-testid="add-team"
                          size="sm"
                          onPress={() =>
                            onNavigate({
                              type: 'teams-add',
                              parentFqn: team.fullyQualifiedName,
                            })
                          }>
                          {t('label.add-entity', {
                            entity: t('label.team'),
                          })}
                        </Button>
                      )}
                    </Box>
                  }
                  loading={isChildTeamsLoading}
                  locale={{
                    emptyText: (
                      <Box
                        align="center"
                        className="tw:min-h-32 tw:relative"
                        justify="center">
                        <EmptyPlaceholder title={t('label.no-data-found')} />
                      </Box>
                    ),
                  }}
                  pagination={false}
                  rowKey="fullyQualifiedName"
                  searchProps={{
                    containerClassName: 'tw:w-80!',
                    placeholder: t('label.search-entity', {
                      entity: t('label.team'),
                    }),
                    searchValue: searchTerm,
                    onSearch: setSearchTerm,
                    typingInterval: 500,
                  }}
                  size="small"
                />
              </DropZone>

              {/* DnD move confirmation modal */}
              {movedTeam && (
                <ModalOverlay
                  isDismissable
                  isOpen
                  data-testid="move-team-modal"
                  style={{ zIndex: 999 }}
                  onOpenChange={(isOpen) => !isOpen && setMovedTeam(undefined)}>
                  <Modal>
                    <Dialog width={400} onClose={() => setMovedTeam(undefined)}>
                      <Dialog.Header className="tw:flex-col">
                        <FeaturedIcon
                          color="brand"
                          icon={ArrowRight}
                          size="lg"
                          theme="light"
                        />
                        <div
                          className="tw:flex tw:flex-col tw:gap-0.5 tw:mt-4 tw:min-w-0 tw:w-full"
                          data-testid="modal-header">
                          <Typography size="text-md" weight="semibold">
                            {t('label.move-the-entity', {
                              entity: t('label.team'),
                            })}
                          </Typography>
                          <Typography
                            as="p"
                            className="tw:text-tertiary tw:break-words">
                            {movedTeam.to ? (
                              <Transi18next
                                i18nKey="message.entity-transfer-message"
                                renderElement={<strong />}
                                values={{
                                  from: getEntityName(movedTeam.from),
                                  to: getEntityName(movedTeam.to),
                                  entity: t('label.team-lowercase'),
                                }}
                              />
                            ) : (
                              t('message.move-entity-to-root', {
                                entity: getEntityName(movedTeam.from),
                              })
                            )}
                          </Typography>
                        </div>
                      </Dialog.Header>
                      <Box
                        className="tw:p-4 tw:pt-6 tw:sm:px-6 tw:sm:pt-8 tw:sm:pb-6"
                        direction="row"
                        gap={3}>
                        <Button
                          className="tw:w-full"
                          color="secondary"
                          data-testid="cancel-button"
                          size="lg"
                          onPress={() => setMovedTeam(undefined)}>
                          {t('label.cancel')}
                        </Button>
                        <Button
                          className="tw:w-full"
                          color="primary"
                          data-testid="confirm-button"
                          size="lg"
                          onPress={handleMoveConfirm}>
                          {t('label.confirm')}
                        </Button>
                      </Box>
                    </Dialog>
                  </Modal>
                </ModalOverlay>
              )}
            </>
          )}

          {/* Users tab */}
          {activeTab === 'users' && (
            <Box direction="col" gap={3}>
              <Table
                columns={userColumns}
                data-testid="team-users-table"
                dataSource={filteredTeamUsers}
                extraTableFilters={
                  <Box align="center" direction="row" gap={2}>
                    {canEditAll && !team.deleted && (
                      <UserTeamSelectableList
                        hasPermission
                        owner={team.users ?? []}
                        onUpdate={(users) => handleAddUsers(users ?? [])}>
                        <Button
                          color="primary"
                          data-testid="add-user"
                          size="sm">
                          {t('label.add-entity', { entity: t('label.user') })}
                        </Button>
                      </UserTeamSelectableList>
                    )}
                    <Dropdown.Root>
                      <Dropdown.DotsButton />
                      <Dropdown.Popover className="tw:w-min">
                        <Dropdown.Menu>
                          <Dropdown.Item
                            data-testid="export-users"
                            icon={Download01}
                            onAction={handleUsersExport}>
                            {t('label.export-entity', {
                              entity: t('label.user-plural'),
                            })}
                          </Dropdown.Item>
                          {isGroupType && canEditAll && !team.deleted && (
                            <Dropdown.Item
                              data-testid="import-users"
                              icon={Upload01}
                              onAction={() =>
                                onNavigate({
                                  type: 'teams-import',
                                  fqn: team.name,
                                  importType: 'users',
                                })
                              }>
                              {t('label.import-entity', {
                                entity: t('label.user-plural'),
                              })}
                            </Dropdown.Item>
                          )}
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown.Root>
                  </Box>
                }
                loading={isTeamUsersLoading}
                locale={{
                  emptyText: (
                    <Box
                      align="center"
                      className="tw:min-h-32 tw:relative"
                      justify="center">
                      <EmptyPlaceholder
                        description={t(
                          'message.adding-new-entity-is-easy-just-give-it-a-spin',
                          { entity: t('label.user') }
                        )}
                        title={t('label.no-entity-found', {
                          entity: t('label.user-plural'),
                        })}
                      />
                    </Box>
                  ),
                }}
                pagination={false}
                rowKey="id"
                searchProps={{
                  placeholder: t('label.search-for-type', {
                    type: t('label.user-lowercase'),
                  }),
                  searchValue: usersSearchTerm,
                  onSearch: setUsersSearchTerm,
                  typingInterval: 500,
                }}
                size="small"
              />
              {showUsersPagination && (
                <PaginationCardWithControls
                  page={usersPage}
                  pageSize={usersPageSize}
                  pageSizeOptions={[
                    PAGE_SIZE_BASE,
                    PAGE_SIZE_MEDIUM,
                    PAGE_SIZE_LARGE,
                  ]}
                  total={Math.max(
                    1,
                    Math.ceil((usersPaging.total ?? 0) / usersPageSize)
                  )}
                  onPageChange={handleTeamUsersPageNavigation}
                  onPageSizeChange={handleUsersPageSizeChange}
                />
              )}
            </Box>
          )}

          {/* Assets tab (Group only) */}
          {activeTab === 'assets' && isGroupType && (
            <Box className="tw:w-full tw:h-full" direction="row">
              <Box className="tw:flex-1 tw:min-w-0">
                <AssetsTabs
                  isSummaryPanelOpen
                  assetCount={assetCount}
                  entityFqn={team.fullyQualifiedName ?? ''}
                  noDataPlaceholder={t('message.adding-new-asset-to-team')}
                  permissions={permissions}
                  queryFilter={assetsQueryFilter}
                  type={AssetsOfEntity.TEAM}
                  onAddAsset={() => {
                    navigate(ROUTES.EXPLORE);
                    closePersonalSpace();
                  }}
                  onAssetClick={setPreviewAsset}
                />
              </Box>
              {previewAsset && (
                <Box className="tw:w-96 tw:border-l tw:border-secondary tw:shrink-0">
                  <EntitySummaryPanel
                    entityDetails={previewAsset}
                    handleClosePanel={() => setPreviewAsset(undefined)}
                  />
                </Box>
              )}
            </Box>
          )}

          {/* Roles tab */}
          {activeTab === 'roles' && (
            <Box direction="col" gap={3}>
              {isAddingRole && (
                <Box
                  className="tw:border tw:border-secondary tw:rounded-xl tw:p-4"
                  direction="col"
                  gap={4}>
                  <Typography
                    className="tw:text-primary"
                    size="text-sm"
                    weight="semibold">
                    {t('label.add-entity', {
                      entity: t('label.role'),
                    })}
                  </Typography>
                  <Autocomplete
                    data-testid="add-role-select"
                    filterOption={(item, filterText) =>
                      contains(item.label || '', filterText) ||
                      contains(String(item.id), filterText)
                    }
                    items={roleItems}
                    placeholder={t('label.search-entity', {
                      entity: t('label.role'),
                    })}
                    selectedItems={selectedNewRoles.map((id) => {
                      const match = availableRoles.find(
                        (r) => (r.fullyQualifiedName ?? r.name) === id
                      );

                      return {
                        id,
                        label: match?.displayName || match?.name || id,
                      };
                    })}
                    onItemCleared={(key: Key) =>
                      setSelectedNewRoles((prev) =>
                        prev.filter((i) => i !== String(key))
                      )
                    }
                    onItemInserted={(key: Key) =>
                      setSelectedNewRoles((prev) => [...prev, String(key)])
                    }>
                    {(item) => (
                      <Autocomplete.Item id={item.id} key={item.id}>
                        {item.label}
                      </Autocomplete.Item>
                    )}
                  </Autocomplete>
                  <Box direction="row" gap={3} justify="end">
                    <Button
                      color="tertiary"
                      size="sm"
                      onPress={() => {
                        setIsAddingRole(false);
                        setSelectedNewRoles([]);
                      }}>
                      {t('label.cancel')}
                    </Button>
                    <Button
                      color="primary"
                      isDisabled={selectedNewRoles.length === 0}
                      isLoading={isSavingInline}
                      size="sm"
                      onPress={handleConfirmAddRoles}>
                      {t('label.save')}
                    </Button>
                  </Box>
                </Box>
              )}
              {canEditAll && !isAddingRole && (
                <Box
                  align="center"
                  className="tw:pb-3"
                  direction="row"
                  justify="end">
                  <Button
                    color="primary"
                    data-testid="add-role"
                    size="sm"
                    onPress={handleStartAddRole}>
                    {t('label.add-entity', {
                      entity: t('label.role'),
                    })}
                  </Button>
                </Box>
              )}
              <Table
                columns={roleColumns}
                data-testid="team-roles-table"
                dataSource={team.defaultRoles ?? []}
                locale={{
                  emptyText: (
                    <Box
                      align="center"
                      className="tw:min-h-32 tw:relative"
                      justify="center">
                      <EmptyPlaceholder
                        description={t(
                          'message.adding-new-entity-is-easy-just-give-it-a-spin',
                          { entity: t('label.role') }
                        )}
                        title={t('label.no-entity-found', {
                          entity: t('label.role-plural'),
                        })}
                      />
                    </Box>
                  ),
                }}
                pagination={false}
                rowKey="id"
                size="small"
              />
            </Box>
          )}

          {/* Policies tab */}
          {activeTab === 'policies' && (
            <Box direction="col" gap={3}>
              {isAddingPolicy && (
                <Box
                  className="tw:border tw:border-secondary tw:rounded-xl tw:p-4"
                  direction="col"
                  gap={4}>
                  <Typography
                    className="tw:text-primary"
                    size="text-sm"
                    weight="semibold">
                    {t('label.add-entity', {
                      entity: t('label.policy'),
                    })}
                  </Typography>
                  <Autocomplete
                    data-testid="add-policy-select"
                    filterOption={(item, filterText) =>
                      contains(item.label || '', filterText) ||
                      contains(String(item.id), filterText)
                    }
                    items={policyItems}
                    placeholder={t('label.search-entity', {
                      entity: t('label.policy'),
                    })}
                    selectedItems={selectedNewPolicies.map((id) => {
                      const match = availablePolicies.find(
                        (p) => (p.fullyQualifiedName ?? p.name) === id
                      );

                      return {
                        id,
                        label: match?.displayName || match?.name || id,
                      };
                    })}
                    onItemCleared={(key: Key) =>
                      setSelectedNewPolicies((prev) =>
                        prev.filter((i) => i !== String(key))
                      )
                    }
                    onItemInserted={(key: Key) =>
                      setSelectedNewPolicies((prev) => [...prev, String(key)])
                    }>
                    {(item) => (
                      <Autocomplete.Item id={item.id} key={item.id}>
                        {item.label}
                      </Autocomplete.Item>
                    )}
                  </Autocomplete>
                  <Box direction="row" gap={3} justify="end">
                    <Button
                      color="tertiary"
                      size="sm"
                      onPress={() => {
                        setIsAddingPolicy(false);
                        setSelectedNewPolicies([]);
                      }}>
                      {t('label.cancel')}
                    </Button>
                    <Button
                      color="primary"
                      isDisabled={selectedNewPolicies.length === 0}
                      isLoading={isSavingInline}
                      size="sm"
                      onPress={handleConfirmAddPolicies}>
                      {t('label.save')}
                    </Button>
                  </Box>
                </Box>
              )}
              {canEditAll && !isAddingPolicy && (
                <Box
                  align="center"
                  className="tw:pb-3"
                  direction="row"
                  justify="end">
                  <Button
                    color="primary"
                    data-testid="add-policy"
                    size="sm"
                    onPress={handleStartAddPolicy}>
                    {t('label.add-entity', {
                      entity: t('label.policy'),
                    })}
                  </Button>
                </Box>
              )}
              <Table
                columns={policyColumns}
                data-testid="team-policies-table"
                dataSource={team.policies ?? []}
                locale={{
                  emptyText: (
                    <Box
                      align="center"
                      className="tw:min-h-32 tw:relative"
                      justify="center">
                      <EmptyPlaceholder
                        description={t(
                          'message.adding-new-entity-is-easy-just-give-it-a-spin',
                          { entity: t('label.policy') }
                        )}
                        title={t('label.no-entity-found', {
                          entity: t('label.policy-plural'),
                        })}
                      />
                    </Box>
                  ),
                }}
                pagination={false}
                rowKey="id"
                size="small"
              />
            </Box>
          )}
        </Box>
      </Box>

      {isDeleting && (
        <DeleteEntityModal
          isRecursiveDelete
          afterDeleteAction={() => onNavigate({ type: 'teams' })}
          allowSoftDelete={!team.deleted}
          entityId={team.id}
          entityName={getEntityName(team)}
          entityType={EntityType.TEAM}
          visible={isDeleting}
          onCancel={() => setIsDeleting(false)}
        />
      )}

      {removeEntity && (
        <DeleteModal
          open
          entityTitle={getEntityName(removeEntity.ref)}
          message={t(
            'message.are-you-sure-you-want-to-remove-child-from-parent',
            {
              child: getEntityName(removeEntity.ref),
              parent: getEntityName(team),
            }
          )}
          onCancel={() => setRemoveEntity(undefined)}
          onDelete={handleConfirmRemove}
        />
      )}
    </Box>
  );
};

export default MembersTeamDetail;

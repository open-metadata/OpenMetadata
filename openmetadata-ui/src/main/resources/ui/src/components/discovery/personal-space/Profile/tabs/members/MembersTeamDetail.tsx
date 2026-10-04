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

import { Box, SelectItemType, Tabs } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { cloneDeep, isEmpty } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFilter } from 'react-aria';
import type { Key } from 'react-aria-components';
import { useDragAndDrop } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../../../../constants/constants';
import { ExportTypes } from '../../../../../../constants/Export.constants';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
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
import { checkPermission } from '../../../../../../utils/PermissionsUtils';
import { getTermQuery } from '../../../../../../utils/SearchPureUtils';
import { getTableExpandableConfig } from '../../../../../../utils/TableUtils';
import { isDropRestricted } from '../../../../../../utils/TeamUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import DeleteModal from '../../../../../common/DeleteModal/DeleteModal';
import DeleteEntityModal from '../../../../../common/DeleteWidget/DeleteEntityModal';
import Loader from '../../../../../common/Loader/Loader';
import { EditorContentRef } from '../../../../../common/RichTextEditor/RichTextEditor.interface';
import type { ExpandableConfig } from '../../../../../common/Table/Table.interface';
import { useEntityExportModalProvider } from '../../../../../Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import type { EntityDetailsObjectInterface } from '../../../../../Explore/ExplorePage.interface';
import type { MembersTeamDetailProps } from './Members.types';
import MembersAssetsTab from './MembersAssetsTab';
import MembersInlineEntityTab from './MembersInlineEntityTab';
import MembersTeamDescription from './MembersTeamDescription';
import type {
  MovedTeam,
  RemoveEntity,
  TeamTab,
} from './MembersTeamDetail.types';
import {
  getAvailableTabs,
  getChildTeamColumns,
  getEntityRefColumns,
  getTabLabel,
  getUserColumns,
  isTeamDropTarget,
  TEAM_DRAG_TYPE,
  TEAM_FIELDS,
  TEAM_USER_FIELDS,
  updateTeamsHierarchy,
  withTeamChildrenPlaceholder,
} from './MembersTeamDetail.utils';
import MembersTeamInfoWidgets from './MembersTeamInfoWidgets';
import MembersTeamsTab from './MembersTeamsTab';
import MembersUsersTab from './MembersUsersTab';
import { profileHash, ProfileHashTarget } from './profileHash.utils';
import { useMembersTeamHeader } from './useMembersTeamHeader';

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
  const [movedTeam, setMovedTeam] = useState<MovedTeam>();
  const draggedTeamRef = useRef<Team>();
  // Monotonic fetch id: a late team response (after navigating to another team,
  // or after unmount) must not report its name up via onRename and clobber the
  // now-current team's header. Bumped on each fetch start and on unmount.
  const fetchIdRef = useRef(0);

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
  const [removeEntity, setRemoveEntity] = useState<RemoveEntity>();

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
    const id = ++fetchIdRef.current;
    setIsLoading(true);
    try {
      const data = await getTeamByName(fqn, {
        fields: TEAM_FIELDS,
        include: Include.All,
      });
      // Ignore a stale response (fqn changed / component unmounted) so it can't
      // overwrite the current team or push a wrong name up via onRename.
      if (id !== fetchIdRef.current) {
        return;
      }
      setTeam(data);
      // Report the fetched display name up so the panel header/breadcrumb show
      // it instead of the raw FQN (and refresh after a rename-driven refetch).
      onRename?.(getEntityName(data));
      const tabs = getAvailableTabs(data.teamType);
      if (!tabs.includes(activeTab)) {
        setActiveTab(tabs[0]);
      }
    } catch (error) {
      if (id === fetchIdRef.current) {
        showErrorToast(error as AxiosError);
      }
    } finally {
      if (id === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [fqn, onRename]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setChildTeams(withTeamChildrenPlaceholder(data));
    } catch (error) {
      showErrorToast(error as AxiosError);
      setChildTeams([]);
    } finally {
      setIsChildTeamsLoading(false);
    }
  }, [team?.fullyQualifiedName, showDeletedTeam]);

  // Lazy-load a row's sub-teams on first expand and graft them into the tree,
  // so the hierarchy is revealed without fetching every level upfront.
  const handleTeamExpand = useCallback(
    async (record: Team) => {
      if (!record.fullyQualifiedName || !isEmpty(record.children)) {
        return;
      }
      try {
        const { data } = await getTeams({
          parentTeam: record.fullyQualifiedName,
          include: showDeletedTeam ? Include.Deleted : Include.NonDeleted,
          fields: [
            TabSpecificField.USER_COUNT,
            TabSpecificField.CHILDREN_COUNT,
            TabSpecificField.OWNS,
            TabSpecificField.PARENTS,
          ],
        });
        setChildTeams((prev) => {
          const next = cloneDeep(prev);
          updateTeamsHierarchy(
            next,
            record.fullyQualifiedName as string,
            withTeamChildrenPlaceholder(data)
          );

          return next;
        });
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [showDeletedTeam]
  );

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

  // Invalidate any in-flight fetchTeam on unmount so its late resolution can't
  // call onRename (which writes the still-mounted panel's state).
  useEffect(() => () => void (fetchIdRef.current += 1), []);

  useEffect(() => {
    if (team) {
      fetchChildTeams();
    }
    // Keyed on the stable team fqn + deleted toggle; the team object and the
    // fetch callback change identity on every refresh and would over-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.fullyQualifiedName, showDeletedTeam]);

  useEffect(() => {
    if (team && activeTab === 'users') {
      fetchTeamUsers();
    }
    // Keyed on the stable team fqn + tab + page size; see note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              displayName: r.displayName,
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
              displayName: p.displayName,
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
      // Sequential by necessity: the patch targets data.id from the fetch above.
      // eslint-disable-next-line openmetadata-imports/review-sequential-api-calls
      await patchTeamDetail(data.id, patch);
      showSuccessToast(t('message.team-moved-success'));
      fetchChildTeams();
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.team-moved-error'));
    } finally {
      setMovedTeam(undefined);
    }
  }, [movedTeam, team, t, fetchChildTeams]);

  // DnD hooks for the team hierarchy table — index nested teams too so dragging
  // a lazily-loaded sub-team resolves its record.
  const teamByName = useMemo(() => {
    const map = new Map<string, Team>();
    const index = (teams: Team[]) => {
      teams.forEach((ct) => {
        map.set(ct.fullyQualifiedName ?? ct.name, ct);
        if (ct.children && ct.children.length > 0) {
          index(ct.children as unknown as Team[]);
        }
      });
    };
    index(childTeams);

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
  const childTeamColumns = useMemo(
    () => getChildTeamColumns(t, onNavigate),
    [t, onNavigate]
  );

  const childTeamExpandable = useMemo<ExpandableConfig<Team>>(
    () => ({
      ...getTableExpandableConfig<Team>(true),
      onExpand: (isOpen, record) => {
        if (isOpen) {
          handleTeamExpand(record);
        }
      },
    }),
    [handleTeamExpand]
  );

  const userColumns = useMemo(
    () =>
      getUserColumns(t, canEditAll, goTo, (record) =>
        setRemoveEntity({
          ref: record as unknown as EntityReference,
          kind: 'user',
        })
      ),
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

  const roleColumns = useMemo(
    () =>
      getEntityRefColumns(
        t,
        canEditAll,
        isSavingInline,
        goTo,
        (ref) => setRemoveEntity({ ref, kind: 'role' }),
        (ref) => profileHash.role(ref.fullyQualifiedName ?? ref.name ?? '')
      ),
    [t, canEditAll, isSavingInline, goTo]
  );

  const policyColumns = useMemo(
    () =>
      getEntityRefColumns(
        t,
        canEditAll,
        isSavingInline,
        goTo,
        (ref) => setRemoveEntity({ ref, kind: 'policy' }),
        (ref) => profileHash.policy(ref.fullyQualifiedName ?? ref.name ?? '')
      ),
    [t, canEditAll, isSavingInline, goTo]
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

  const inlineFilterOption = useCallback(
    (item: SelectItemType, filterText: string) =>
      contains(item.label || '', filterText) ||
      contains(String(item.id), filterText),
    [contains]
  );

  const handleCancelAddRole = useCallback(() => {
    setIsAddingRole(false);
    setSelectedNewRoles([]);
  }, []);

  const handleRoleItemCleared = useCallback(
    (id: string) => setSelectedNewRoles((prev) => prev.filter((i) => i !== id)),
    []
  );

  const handleRoleItemInserted = useCallback(
    (id: string) => setSelectedNewRoles((prev) => [...prev, id]),
    []
  );

  const handleCancelAddPolicy = useCallback(() => {
    setIsAddingPolicy(false);
    setSelectedNewPolicies([]);
  }, []);

  const handlePolicyItemCleared = useCallback(
    (id: string) =>
      setSelectedNewPolicies((prev) => prev.filter((i) => i !== id)),
    []
  );

  const handlePolicyItemInserted = useCallback(
    (id: string) => setSelectedNewPolicies((prev) => [...prev, id]),
    []
  );

  const handleAddAsset = useCallback(() => {
    navigate(ROUTES.EXPLORE);
    closePersonalSpace();
  }, [navigate, closePersonalSpace]);

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
  useMembersTeamHeader({
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
    onEditNameValueChange: setEditNameValue,
    onStartEditName: (value) => {
      setEditNameValue(value);
      setIsEditingName(true);
    },
    onCancelEditName: () => setIsEditingName(false),
    onSaveDisplayName: handleSaveDisplayName,
    onTeamExport: handleTeamExport,
    onTeamImport: handleTeamImport,
    onToggleJoinable: handleToggleJoinable,
    onRestoreTeam: handleRestoreTeam,
    onJoinTeam: handleJoinTeam,
    onLeaveTeam: handleLeaveTeam,
    onDelete: () => setIsDeleting(true),
    onSetHeaderActions,
    onSetHeaderTitleInput,
    onSetHeaderTitleSuffix,
  });

  if (isLoading) {
    return <Loader />;
  }

  if (!team) {
    return null;
  }

  const canEditDescInline = (canEditAll || canEditDescription) && !team.deleted;

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'teams':
        return (
          <MembersTeamsTab
            canCreateTeam={canCreateTeam}
            childTeamColumns={childTeamColumns}
            childTeamExpandable={childTeamExpandable}
            dragAndDropHooks={dragAndDropHooks}
            draggedTeamRef={draggedTeamRef}
            filteredChildTeams={filteredChildTeams}
            isChildTeamsLoading={isChildTeamsLoading}
            isTableHovered={isTableHovered}
            movedTeam={movedTeam}
            searchTerm={searchTerm}
            showDeletedTeam={showDeletedTeam}
            team={team}
            onMoveConfirm={handleMoveConfirm}
            onNavigate={onNavigate}
            onSearchTermChange={setSearchTerm}
            onSetMovedTeam={setMovedTeam}
            onShowDeletedTeamChange={setShowDeletedTeam}
          />
        );
      case 'users':
        return (
          <MembersUsersTab
            canEditAll={canEditAll}
            filteredTeamUsers={filteredTeamUsers}
            isGroupType={isGroupType}
            isTeamUsersLoading={isTeamUsersLoading}
            showUsersPagination={showUsersPagination}
            team={team}
            userColumns={userColumns}
            usersPage={usersPage}
            usersPageSize={usersPageSize}
            usersPaging={usersPaging}
            usersSearchTerm={usersSearchTerm}
            onAddUsers={handleAddUsers}
            onNavigate={onNavigate}
            onTeamUsersPageNavigation={handleTeamUsersPageNavigation}
            onUsersExport={handleUsersExport}
            onUsersPageSizeChange={handleUsersPageSizeChange}
            onUsersSearchTermChange={setUsersSearchTerm}
          />
        );
      case 'assets':
        return isGroupType ? (
          <MembersAssetsTab
            assetCount={assetCount}
            assetsQueryFilter={assetsQueryFilter}
            permissions={permissions}
            previewAsset={previewAsset}
            team={team}
            onAddAsset={handleAddAsset}
            onAssetClick={setPreviewAsset}
            onClosePreview={() => setPreviewAsset(undefined)}
          />
        ) : null;
      case 'roles':
        return (
          <MembersInlineEntityTab
            addButtonTestId="add-role"
            addSelectTestId="add-role-select"
            available={availableRoles}
            canEditAll={canEditAll}
            columns={roleColumns}
            dataSource={team.defaultRoles ?? []}
            entityLabel={t('label.role')}
            entityPluralLabel={t('label.role-plural')}
            filterOption={inlineFilterOption}
            isAdding={isAddingRole}
            isSavingInline={isSavingInline}
            items={roleItems}
            selectedNew={selectedNewRoles}
            tableTestId="team-roles-table"
            onCancelAdd={handleCancelAddRole}
            onConfirmAdd={handleConfirmAddRoles}
            onItemCleared={handleRoleItemCleared}
            onItemInserted={handleRoleItemInserted}
            onStartAdd={handleStartAddRole}
          />
        );
      default:
        return (
          <MembersInlineEntityTab
            addButtonTestId="add-policy"
            addSelectTestId="add-policy-select"
            available={availablePolicies}
            canEditAll={canEditAll}
            columns={policyColumns}
            dataSource={team.policies ?? []}
            entityLabel={t('label.policy')}
            entityPluralLabel={t('label.policy-plural')}
            filterOption={inlineFilterOption}
            isAdding={isAddingPolicy}
            isSavingInline={isSavingInline}
            items={policyItems}
            selectedNew={selectedNewPolicies}
            tableTestId="team-policies-table"
            onCancelAdd={handleCancelAddPolicy}
            onConfirmAdd={handleConfirmAddPolicies}
            onItemCleared={handlePolicyItemCleared}
            onItemInserted={handlePolicyItemInserted}
            onStartAdd={handleStartAddPolicy}
          />
        );
    }
  };

  return (
    <Box
      className="tw:h-full tw:min-h-0 tw:overflow-hidden"
      data-testid="team-detail"
      direction="col">
      {/* Pinned header: info widgets + description. Capped at half the height and
          scrollable so a long description or the open inline editor (incl. its
          Save/Cancel) can't push the tab table to zero height or get clipped. */}
      <Box
        className="tw:shrink-0 tw:max-h-[50%] tw:overflow-y-auto"
        direction="col">
        {/* Info widget section */}
        <MembersTeamInfoWidgets
          canEdit={canEditAll && !team.deleted}
          team={team}
          onPatch={handlePatchTeam}
        />

        {/* Description (inline editor — no modal) */}
        <MembersTeamDescription
          canEditDescInline={canEditDescInline}
          descEditorRef={descEditorRef}
          isDescEditing={isDescEditing}
          isDescSaving={isDescSaving}
          team={team}
          onCancelEdit={() => setIsDescEditing(false)}
          onSave={handleDescriptionSave}
          onStartEdit={() => setIsDescEditing(true)}
        />
      </Box>

      {/* Tabs */}
      <Box className="tw:px-8 tw:flex-1 tw:min-h-0" direction="col">
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
          {renderActiveTab()}
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

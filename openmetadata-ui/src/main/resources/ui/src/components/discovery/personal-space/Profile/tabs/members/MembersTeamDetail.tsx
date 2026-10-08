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
import { Reorder } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { cloneDeep, isEmpty } from 'lodash';
import {
  FC,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { Operation } from '../../../../../../generated/entity/policies/policy';
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
import { getUsers, updateUserDetail } from '../../../../../../rest/userAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { getDerivedPermissionFlags } from '../../../../../../utils/PermissionDerivation';
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
import { profileHash } from './profileHash.utils';
import withSuspenseFallback from '../../../../../AppRouter/withSuspenseFallback';
import type {
  CustomPropertyProps,
  ExtentionEntitiesKeys,
} from '../../../../../common/CustomPropertyTable/CustomPropertyTable.interface';
import { useApplicationsProvider } from '../../../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import {
  EXTENSION_POINTS,
  type TabContribution,
} from '../../../../../../utils/ExtensionPointTypes';
import { useMembersTeamHeader } from './useMembersTeamHeader';

const CUSTOM_PROPERTIES = 'custom-properties' as const;

// Lazy-loaded for the same reason TeamDetailsV1 does it: the custom-property
// table pulls in the RJSF form stack, which no other team tab needs.
const CustomPropertyTable = withSuspenseFallback(
  lazy(() =>
    import(
      '../../../../../common/CustomPropertyTable/CustomPropertyTable'
    ).then((module) => ({ default: module.CustomPropertyTable }))
  )
  // withSuspenseFallback erases the component's generic; restore it the same
  // way TeamDetailsV1 does so `entityDetails` narrows to Team.
) as <T extends ExtentionEntitiesKeys>(
  props: CustomPropertyProps<T>
) => JSX.Element;

// The global `.drag-icon { width: 6px }` LESS rule is tuned for the legacy 8×15
// drag.svg; the square 20×20 Reorder icon collapses to ~6px there. An inline
// size beats the unlayered LESS rule so the handle stays usable.
const ReorderDragIcon: FC<{ className?: string }> = ({ className }) => (
  <Reorder className={className} style={{ height: 16, width: 16 }} />
);

// The inline role/policy add flow is identical bar the team field it writes to.
type InlineAddField = 'defaultRoles' | 'policies';
type AddOption = {
  id: string;
  name: string;
  fullyQualifiedName?: string;
  displayName?: string;
};
const ADD_REF_TYPE: Record<InlineAddField, string> = {
  defaultRoles: 'role',
  policies: 'policy',
};

const MembersTeamDetail: FC<MembersTeamDetailProps> = ({
  fqn,
  onNavigate,
  onRename,
  onSetHeader,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getContributions } = useApplicationsProvider();
  const { permissions: globalPermissions } = usePermissionProvider();
  const { showModal } = useEntityExportModalProvider();
  const { currentUser } = useApplicationStore();
  const closePersonalSpace = usePersonalSpaceStore((state) => state.close);
  const { goTo } = useSettingsHash();

  const [team, setTeam] = useState<Team>();
  const [childTeams, setChildTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChildTeamsLoading, setIsChildTeamsLoading] = useState(false);
  const [showDeletedTeam, setShowDeletedTeam] = useState(false);
  // Holds a native TeamTab or a contributed plugin tab's key.
  const [activeTab, setActiveTab] = useState<string>('teams');
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

  // Inline add role/policy — only one tab is ever adding at a time, so a single
  // field-keyed add session serves both (defaultRoles | policies).
  const [addingField, setAddingField] = useState<InlineAddField | null>(null);
  const [addOptions, setAddOptions] = useState<AddOption[]>([]);
  const [selectedNew, setSelectedNew] = useState<string[]>([]);

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

  const {
    canEditAll,
    canEditCustomFields,
    canEditDescription,
    canEditDisplayName,
    canViewCustomFields,
    permissions,
  } = useEntityPermissions(ResourceEntity.TEAM, fqn, {
    deleted: team?.deleted,
    enabled: Boolean(fqn),
  });

  // Ungated edit flag: the deleted-aware canEditAll is false on a soft-deleted
  // team, which would hide the only affordance to restore it (precedent:
  // DataAssetsHeader's ungatedFlags).
  const canRestore = useMemo(
    () => getDerivedPermissionFlags(permissions).canEditAll,
    [permissions]
  );

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

  // Read the active tab through a ref so fetchTeam doesn't list it as a dep and
  // refetch the whole team on every tab switch — it only needs the current tab to
  // decide whether the fetched team type still contains it.
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  // Read inside the fetch callback, which must not depend on the plugin list.
  const pluginTabKeysRef = useRef<string[]>([]);

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
      // Only reset when the active tab is neither valid for the new team type
      // nor a contributed plugin tab (whose keys aren't in getAvailableTabs, so
      // a bare includes() check would knock the user off it on every refetch).
      const tabs = getAvailableTabs(data.teamType);
      const isPluginTab = pluginTabKeysRef.current.includes(
        activeTabRef.current
      );
      if (!isPluginTab && !tabs.includes(activeTabRef.current as TeamTab)) {
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
  }, [fqn, onRename]);

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
    void fetchTeamUsers({ [cursorType]: cursor });
  };

  useEffect(() => {
    void fetchTeam();
  }, [fetchTeam]);

  // Invalidate any in-flight fetchTeam on unmount so its late resolution can't
  // call onRename (which writes the still-mounted panel's state).
  useEffect(
    () => () => {
      fetchIdRef.current += 1;
    },
    []
  );

  // Keyed on the stable team fqn + deleted toggle; the team object and the fetch
  // callbacks change identity on every refresh, so they're read through refs here
  // to avoid over-firing.
  const refetchChildTeams = useRef<() => void>(() => undefined);
  refetchChildTeams.current = () => {
    if (team) {
      void fetchChildTeams();
    }
  };

  const refetchTeamUsers = useRef<() => void>(() => undefined);
  refetchTeamUsers.current = () => {
    if (team && activeTab === 'users') {
      void fetchTeamUsers();
    }
  };

  useEffect(() => {
    refetchChildTeams.current();
  }, [team?.fullyQualifiedName, showDeletedTeam]);

  useEffect(() => {
    refetchTeamUsers.current();
  }, [team?.fullyQualifiedName, activeTab, usersPageSize]);

  // Returns true only when the PATCH succeeded (or was a no-op), so callers can
  // gate side effects (close editor, rename header) on actual success.
  const handlePatchTeam = useCallback(
    async (updatedTeam: Team): Promise<boolean> => {
      if (!team) {
        return false;
      }
      const patch = compare(team, updatedTeam);
      if (patch.length === 0) {
        return true;
      }
      try {
        const res = await patchTeamDetail(team.id, patch);
        setTeam(res);
        showSuccessToast(
          t('server.update-entity-success', { entity: t('label.team') })
        );

        return true;
      } catch (error) {
        showErrorToast(error as AxiosError);

        return false;
      }
    },
    [team, t]
  );

  // CustomPropertyTable hands back the whole team with `extension` replaced;
  // handlePatchTeam diffs it, so no separate extension-only path is needed.
  const handleTeamExtensionUpdate = useCallback(
    async (updatedTeam: Team): Promise<void> => {
      await handlePatchTeam(updatedTeam);
    },
    [handlePatchTeam]
  );

  const handleDescriptionSave = useCallback(async () => {
    if (!team) {
      return;
    }
    const value = descEditorRef.current?.getEditorContent() ?? '';
    setIsDescSaving(true);
    try {
      if (await handlePatchTeam({ ...team, description: value })) {
        setIsDescEditing(false);
      }
    } finally {
      setIsDescSaving(false);
    }
  }, [team, handlePatchTeam]);

  const handleSaveDisplayName = useCallback(async () => {
    if (!team) {
      return;
    }
    const trimmed = editNameValue.trim();
    if (await handlePatchTeam({ ...team, displayName: trimmed })) {
      onRename?.(trimmed || team.name);
      setIsEditingName(false);
    }
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
    void handlePatchTeam({ ...team, isJoinable: !team.isJoinable });
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
      await updateUserDetail(currentUser.id, patch);
      showSuccessToast(
        t('server.join-team-success', { team: getEntityName(team) })
      );
      void fetchTeam();
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
      void fetchTeam();
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
        void fetchTeam();
        void fetchTeamUsers();
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
      void fetchTeamUsers();
    },
    [team, handlePatchTeam, fetchTeamUsers]
  );

  const handleStartAdd = useCallback(
    async (field: InlineAddField) => {
      setAddingField(field);
      setSelectedNew([]);
      try {
        const data =
          field === 'defaultRoles'
            ? (await getRoles('', undefined, undefined, false, 100)).data
            : (await getPolicies('', undefined, undefined, 100)).data;
        const existingIds = new Set((team?.[field] ?? []).map((e) => e.id));
        setAddOptions((data ?? []).filter((o) => !existingIds.has(o.id)));
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [team]
  );

  const handleConfirmAdd = useCallback(async () => {
    if (!team || !addingField || selectedNew.length === 0) {
      return;
    }
    const field = addingField;
    const newRefs = selectedNew
      .map((fqnOrName) => {
        const o = addOptions.find(
          (a) => a.fullyQualifiedName === fqnOrName || a.name === fqnOrName
        );

        return o
          ? ({
              id: o.id,
              type: ADD_REF_TYPE[field],
              fullyQualifiedName: o.fullyQualifiedName,
              name: o.name,
              displayName: o.displayName,
            } as EntityReference)
          : null;
      })
      .filter(Boolean) as EntityReference[];
    setIsSavingInline(true);
    const ok = await handlePatchTeam({
      ...team,
      [field]: [...(team[field] ?? []), ...newRefs],
    });
    if (ok) {
      setAddingField(null);
      setSelectedNew([]);
    }
    setIsSavingInline(false);
  }, [team, addingField, selectedNew, addOptions, handlePatchTeam]);

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
      // eslint-disable-next-line openmetadata-imports/review-sequential-api-calls -- patch needs the fetched id + diff
      await patchTeamDetail(data.id, patch);
      showSuccessToast(t('message.team-moved-success'));
      void fetchChildTeams();
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
      ...getTableExpandableConfig<Team>(true, undefined, ReorderDragIcon),
      onExpand: (isOpen, record) => {
        if (isOpen) {
          void handleTeamExpand(record);
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

  const handleRemoveEntity = useCallback(
    async (field: InlineAddField, ref: EntityReference) => {
      if (!team) {
        return;
      }
      setIsSavingInline(true);
      await handlePatchTeam({
        ...team,
        [field]: (team[field] ?? []).filter((e) => e.id !== ref.id),
      });
      setIsSavingInline(false);
    },
    [team, handlePatchTeam]
  );

  const handleConfirmRemove = useCallback(async () => {
    if (!removeEntity) {
      return;
    }
    const { ref, kind } = removeEntity;
    if (kind === 'user') {
      await handleRemoveUser(ref.id);
    } else {
      await handleRemoveEntity(
        kind === 'role' ? 'defaultRoles' : 'policies',
        ref
      );
    }
    setRemoveEntity(undefined);
  }, [removeEntity, handleRemoveUser, handleRemoveEntity]);

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

  // Downstream builds (e.g. Collate's Query Runner) contribute extra team tabs.
  // Read through `getContributions` rather than the registry directly so this
  // memo recomputes once contributions are actually registered — the registry's
  // identity never changes, so keying on it alone would miss them permanently.
  const pluginTabs = useMemo(() => {
    const extensionContext = { teamId: team?.id };

    return getContributions<TabContribution>(EXTENSION_POINTS.TEAM_DETAILS_TABS)
      .filter((tab) =>
        tab.condition ? tab.condition(extensionContext) : !tab.isHidden
      )
      .map((tab) => ({
        key: tab.key,
        // Contributions may carry a literal or an i18n key; `t` returns the
        // input unchanged when it isn't a known key, so this covers both.
        label: typeof tab.label === 'string' ? t(tab.label) : tab.key,
        component: tab.component,
      }));
  }, [getContributions, team?.id, t]);

  const allTabKeys = useMemo(
    () => [...availableTabs, ...pluginTabs.map((tab) => tab.key)],
    [availableTabs, pluginTabs]
  );

  const activePluginTab = useMemo(
    () => pluginTabs.find((tab) => tab.key === activeTab),
    [pluginTabs, activeTab]
  );

  pluginTabKeysRef.current = pluginTabs.map((tab) => tab.key);

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

  const addItems = useMemo<SelectItemType[]>(
    () =>
      addOptions.map((o) => ({
        id: o.fullyQualifiedName ?? o.name,
        label: o.displayName || o.name,
      })),
    [addOptions]
  );

  const inlineFilterOption = useCallback(
    (item: SelectItemType, filterText: string) =>
      contains(item.label || '', filterText) ||
      contains(String(item.id), filterText),
    [contains]
  );

  const handleCancelAdd = useCallback(() => {
    setAddingField(null);
    setSelectedNew([]);
  }, []);

  const handleItemCleared = useCallback(
    (id: string) => setSelectedNew((prev) => prev.filter((i) => i !== id)),
    []
  );

  const handleItemInserted = useCallback(
    (id: string) => setSelectedNew((prev) => [...prev, id]),
    []
  );

  const handleAddAsset = useCallback(() => {
    void navigate(ROUTES.EXPLORE);
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
    void fetchAssetCount();
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
    canRestore,
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
    onSetHeader,
  });

  if (isLoading) {
    return <Loader />;
  }

  if (!team) {
    return null;
  }

  const canEditDescInline = (canEditAll || canEditDescription) && !team.deleted;

  const renderActiveTab = () => {
    if (activePluginTab) {
      const PluginTabComponent = activePluginTab.component;

      return <PluginTabComponent teamId={team.id} />;
    }

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
            available={addOptions}
            canEditAll={canEditAll}
            columns={roleColumns}
            dataSource={team.defaultRoles ?? []}
            entityLabel={t('label.role')}
            entityPluralLabel={t('label.role-plural')}
            filterOption={inlineFilterOption}
            isAdding={addingField === 'defaultRoles'}
            isSavingInline={isSavingInline}
            items={addItems}
            selectedNew={selectedNew}
            tableTestId="team-roles-table"
            onCancelAdd={handleCancelAdd}
            onConfirmAdd={handleConfirmAdd}
            onItemCleared={handleItemCleared}
            onItemInserted={handleItemInserted}
            onStartAdd={() => handleStartAdd('defaultRoles')}
          />
        );
      case CUSTOM_PROPERTIES:
        return (
          <CustomPropertyTable<EntityType.TEAM>
            entityDetails={team}
            entityType={EntityType.TEAM}
            hasEditAccess={Boolean(canEditCustomFields) && !team.deleted}
            hasPermission={Boolean(canViewCustomFields)}
            onEntityUpdate={handleTeamExtensionUpdate}
          />
        );
      default:
        return (
          <MembersInlineEntityTab
            addButtonTestId="add-policy"
            addSelectTestId="add-policy-select"
            available={addOptions}
            canEditAll={canEditAll}
            columns={policyColumns}
            dataSource={team.policies ?? []}
            entityLabel={t('label.policy')}
            entityPluralLabel={t('label.policy-plural')}
            filterOption={inlineFilterOption}
            isAdding={addingField === 'policies'}
            isSavingInline={isSavingInline}
            items={addItems}
            selectedNew={selectedNew}
            tableTestId="team-policies-table"
            onCancelAdd={handleCancelAdd}
            onConfirmAdd={handleConfirmAdd}
            onItemCleared={handleItemCleared}
            onItemInserted={handleItemInserted}
            onStartAdd={() => handleStartAdd('policies')}
          />
        );
    }
  };

  return (
    <Box
      className="tw:flex-1 tw:h-full tw:min-h-0 tw:overflow-hidden"
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
          onSelectionChange={(key: Key) => setActiveTab(String(key))}>
          <Tabs.List size="sm" type="underline">
            {allTabKeys.map((tab) => {
              const plugin = pluginTabs.find((item) => item.key === tab);

              return (
                <Tabs.Item id={tab} key={tab}>
                  {plugin
                    ? plugin.label
                    : getTabLabel(
                        tab as TeamTab,
                        t,
                        team,
                        childTeams.length,
                        assetCount
                      )}
                </Tabs.Item>
              );
            })}
          </Tabs.List>
        </Tabs>

        {/* A plain block, NOT a `Box`: `Box` is display:flex, and inside a flex
            container the tab content becomes a flex item that shrinks to the
            container's height instead of overflowing it, so `overflow-auto`
            never has anything to scroll (measured: scrollHeight stays equal to
            clientHeight). A block container lets the content keep its natural
            height and scroll. `min-h-0` keeps the flex parent from growing. */}
        <div className="tw:flex-1 tw:min-h-0 tw:w-full tw:overflow-y-auto tw:py-4">
          {renderActiveTab()}
        </div>
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

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

import type { SelectItemType } from '@openmetadata/ui-core-components';
import type { ReactNode } from 'react';
import type { DragAndDropHooks } from 'react-aria-components';
import type { OperationPermission } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import type { Team } from '../../../../../../generated/entity/teams/team';
import type { User } from '../../../../../../generated/entity/teams/user';
import type { EntityReference } from '../../../../../../generated/entity/type';
import type { getTermQuery } from '../../../../../../utils/SearchPureUtils';
import type {
  ColumnsType,
  ExpandableConfig,
} from '../../../../../common/Table/Table.interface';
import type { EntityDetailsObjectInterface } from '../../../../../Explore/ExplorePage.interface';
import type { MembersView } from './Members.types';

export type TeamTab = 'teams' | 'users' | 'assets' | 'roles' | 'policies';

export type AssetsQueryFilter = ReturnType<typeof getTermQuery>;

export interface MovedTeam {
  from: Team;
  to?: Team;
}

export interface RemoveEntity {
  ref: EntityReference;
  kind: 'user' | 'role' | 'policy';
}

export interface MembersTeamInfoWidgetsProps {
  team: Team;
  canEdit: boolean;
  // Resolves true only when the patch succeeded, so editors can close on success.
  onPatch: (updated: Team) => Promise<boolean>;
}

export interface MembersTeamsTabProps {
  team: Team;
  childTeamColumns: ColumnsType<Team>;
  childTeamExpandable: ExpandableConfig<Team>;
  filteredChildTeams: Team[];
  dragAndDropHooks: DragAndDropHooks;
  draggedTeamRef: React.MutableRefObject<Team | undefined>;
  isTableHovered: boolean;
  isChildTeamsLoading: boolean;
  showDeletedTeam: boolean;
  searchTerm: string;
  canCreateTeam: boolean;
  movedTeam?: MovedTeam;
  onShowDeletedTeamChange: (value: boolean) => void;
  onSearchTermChange: (value: string) => void;
  onNavigate: (view: MembersView) => void;
  onSetMovedTeam: (value: MovedTeam | undefined) => void;
  onMoveConfirm: () => void;
}

export interface MembersUsersTabProps {
  team: Team;
  userColumns: ColumnsType<User>;
  filteredTeamUsers: User[];
  isTeamUsersLoading: boolean;
  usersSearchTerm: string;
  canEditAll: boolean;
  isGroupType: boolean;
  usersPage: number;
  usersPageSize: number;
  usersPaging: { total?: number };
  showUsersPagination: boolean;
  onUsersSearchTermChange: (value: string) => void;
  onAddUsers: (users: EntityReference[]) => void;
  onUsersExport: () => void;
  onNavigate: (view: MembersView) => void;
  onTeamUsersPageNavigation: (newPage: number) => void;
  onUsersPageSizeChange: (size: number) => void;
}

export interface MembersAssetsTabProps {
  team: Team;
  assetCount: number;
  permissions: OperationPermission;
  assetsQueryFilter: AssetsQueryFilter;
  previewAsset?: EntityDetailsObjectInterface;
  onAddAsset: () => void;
  onAssetClick: (asset?: EntityDetailsObjectInterface) => void;
  onClosePreview: () => void;
}

export interface MembersInlineEntityTabProps {
  dataSource: EntityReference[];
  columns: ColumnsType<EntityReference>;
  canEditAll: boolean;
  isAdding: boolean;
  isSavingInline: boolean;
  items: SelectItemType[];
  selectedNew: string[];
  available: Array<{
    fullyQualifiedName?: string;
    name: string;
    displayName?: string;
  }>;
  entityLabel: string;
  entityPluralLabel: string;
  tableTestId: string;
  addButtonTestId: string;
  addSelectTestId: string;
  filterOption: (item: SelectItemType, filterText: string) => boolean;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onConfirmAdd: () => void;
  onItemInserted: (id: string) => void;
  onItemCleared: (id: string) => void;
}

export interface MembersTeamDescriptionProps {
  team: Team;
  canEditDescInline: boolean;
  isDescEditing: boolean;
  isDescSaving: boolean;
  descEditorRef: React.Ref<
    import('../../../../../common/RichTextEditor/RichTextEditor.interface').EditorContentRef
  >;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
}

export interface UseMembersTeamHeaderParams {
  team?: Team;
  isLoading: boolean;
  isEditingName: boolean;
  editNameValue: string;
  canEditAll: boolean;
  canEditDisplayName: boolean;
  canDelete: boolean;
  canCreateTeam: boolean;
  isGroupType: boolean;
  isOrgType: boolean;
  isCurrentUserMember: boolean;
  onEditNameValueChange: (value: string) => void;
  onStartEditName: (value: string) => void;
  onCancelEditName: () => void;
  onSaveDisplayName: () => void;
  onTeamExport: () => void;
  onTeamImport: () => void;
  onToggleJoinable: () => void;
  onRestoreTeam: () => void;
  onJoinTeam: () => void;
  onLeaveTeam: () => void;
  onDelete: () => void;
  onSetHeaderActions?: (actions: ReactNode) => void;
  onSetHeaderTitleInput?: (input: ReactNode) => void;
  onSetHeaderTitleSuffix?: (suffix: ReactNode) => void;
}

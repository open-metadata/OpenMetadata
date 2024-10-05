/*
 *  Copyright 2022 Collate.
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

import { Operation } from 'fast-json-patch';
import { FormErrorData } from 'Models';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { EntityType } from '../../../../enums/entity.enum';
import { UserType } from '../../../../enums/user.enum';
import { Team } from '../../../../generated/entity/teams/team';
import { User } from '../../../../generated/entity/teams/user';
import { EntityReference } from '../../../../generated/entity/type';
import { Paging } from '../../../../generated/type/paging';

export type TeamDeleteType = {
  team: Team | undefined;
  state: boolean;
};

export type ModifiedTeam = Omit<Team, 'children'> & {
  children: Team[];
};

export interface TeamsAndUsersProps {
  hasAccess: boolean;
  isUsersLoading: boolean;
  isTeamMemberLoading: boolean;
  isTeamVisible: boolean;
  activeUserTab: UserType | undefined;
  activeUserTabHandler: (value: UserType | undefined) => void;
  usersCount: number;
  adminsCount: number;
  selectedUserList: User[];
  teams: Team[];
  currentTeam: Team;
  currentTeamUsers: User[];
  teamUserPagin: Paging;
  userPaging: Paging;
  currentTeamUserPage: number;
  currentUserPage: number;
  isDescriptionEditable: boolean;
  isRightPannelLoading: boolean;
  errorNewTeamData: FormErrorData | undefined;
  isAddingTeam: boolean;
  createNewTeam: (data: Team) => void;
  handleAddTeam: (value: boolean) => void;
  onNewTeamDataChange: (
    data: Team,
    forceSet?: boolean
  ) => {
    [key: string]: string;
  };
  updateTeamHandler: (data: Team) => Promise<void>;
  handleDeleteUser: () => void;
  handleTeamUsersSearchAction: (text: string) => void;
  teamUserPaginHandler: (
    cursorValue: string | number,
    activePage?: number
  ) => void;
  userPagingHandler: (
    cursorValue: string | number,
    activePage?: number
  ) => void;
  changeCurrentTeam: (name: string, isUsersCategory: boolean) => void;
  descriptionHandler: (value: boolean) => void;
  onDescriptionUpdate: (value: string) => void;
  handleJoinTeamClick: (id: string, data: Operation[]) => void;
  handleLeaveTeamClick: (id: string, data: Operation[]) => Promise<void>;
  isAddingUsers: boolean;
  getUniqueUserList: () => Array<EntityReference>;
  addUsersToTeam: (data: Array<EntityReference>) => void;
  handleAddUser: (data: boolean) => void;
  removeUserFromTeam: (id: string) => Promise<void>;
  handleUserSearchTerm: (value: string) => void;
  userSearchTerm: string;
  handleAddNewUser: () => void;
  afterDeleteAction: () => void;
}

export interface TeamDetailsProp {
  assetsCount: number;
  currentTeam: Team;
  teams?: Team[];
  isDescriptionEditable: boolean;
  isTeamMemberLoading: number;
  isFetchingAdvancedDetails: boolean;
  isFetchingAllTeamAdvancedDetails: boolean;
  entityPermissions: OperationPermission;
  handleAddTeam: (value: boolean) => void;
  descriptionHandler: (value: boolean) => void;
  onDescriptionUpdate: (value: string) => Promise<void>;
  updateTeamHandler: (data: Team, fetchTeam?: boolean) => Promise<void>;
  handleAddUser: (data: Array<EntityReference>) => Promise<void>;
  afterDeleteAction: (isSoftDeleted?: boolean) => void;
  removeUserFromTeam: (id: string) => Promise<void>;
  handleJoinTeamClick: (id: string, data: Operation[]) => void;
  handleLeaveTeamClick: (id: string, data: Operation[]) => Promise<void>;
  childTeams: Team[];
  showDeletedTeam: boolean;
  onShowDeletedTeamChange: () => void;
  parentTeams: Team[];
  onTeamExpand: (
    loading?: boolean,
    parentTeam?: string,
    updateChildNode?: boolean
  ) => void;
}

export interface AddAttribute {
  type: EntityType;
  selectedData: EntityReference[];
}

export interface PlaceholderProps {
  permission?: boolean;
  onClick?: () => void;
  heading?: string;
  button?: React.ReactNode;
  doc?: string;
  type?: ERROR_PLACEHOLDER_TYPE;
  children?: React.ReactNode;
}

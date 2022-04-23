/*
 *  Copyright 2021 Collate
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
import { UserType } from '../enums/user.enum';
import { Team } from '../generated/entity/teams/team';
import {
  EntityReference as UserTeams,
  User,
} from '../generated/entity/teams/user';
import { Paging } from '../generated/type/paging';

export type TeamDeleteType = {
  team: Team | undefined;
  state: boolean;
};

export interface TeamsAndUsersProps {
  hasAccess: boolean;
  isUsersLoading: boolean;
  isTeamMemberLoading: boolean;
  isTeamVisible: boolean;
  activeUserTab: UserType | undefined;
  activeUserTabHandler: (value: UserType | undefined) => void;
  users: User[];
  admins: User[];
  selectedUserList: User[];
  bots: User[];
  teams: Team[];
  currentTeam: Team | undefined;
  currentTeamUsers: User[];
  teamUserPagin: Paging;
  currentTeamUserPage: number;
  teamUsersSearchText: string;
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
  handleDeleteUser: (id: string) => void;
  handleTeamUsersSearchAction: (text: string) => void;
  teamUserPaginHandler: (
    cursorValue: string | number,
    activePage?: number
  ) => void;
  changeCurrentTeam: (name: string, isUsersCategory: boolean) => void;
  descriptionHandler: (value: boolean) => void;
  onDescriptionUpdate: (value: string) => void;
  handleJoinTeamClick: (id: string, data: Operation[]) => void;
  handleLeaveTeamClick: (id: string, data: Operation[]) => Promise<void>;
  isAddingUsers: boolean;
  getUniqueUserList: () => Array<UserTeams>;
  addUsersToTeam: (data: Array<UserTeams>) => void;
  handleAddUser: (data: boolean) => void;
  removeUserFromTeam: (id: string) => Promise<void>;
  handleUserSearchTerm: (value: string) => void;
  userSearchTerm: string;
  handleAddNewUser: () => void;
}

export interface TeamDetailsProp {
  currentTeam: Team | undefined;
  teams: Team[];
  currentTeamUsers: User[];
  teamUserPagin: Paging;
  currentTeamUserPage: number;
  teamUsersSearchText: string;
  isDescriptionEditable: boolean;
  isTeamMemberLoading: boolean;
  hasAccess: boolean;
  errorNewTeamData: FormErrorData | undefined;
  isAddingTeam: boolean;
  handleAddTeam: (value: boolean) => void;
  onNewTeamDataChange: (
    data: Team,
    forceSet?: boolean
  ) => {
    [key: string]: string;
  };
  descriptionHandler: (value: boolean) => void;
  onDescriptionUpdate: (value: string) => void;
  handleTeamUsersSearchAction: (text: string) => void;
  updateTeamHandler: (data: Team) => Promise<void>;
  createNewTeam: (data: Team) => void;
  teamUserPaginHandler: (
    cursorValue: string | number,
    activePage?: number
  ) => void;
  isAddingUsers: boolean;
  getUniqueUserList: () => Array<UserTeams>;
  addUsersToTeam: (data: Array<UserTeams>) => void;
  handleAddUser: (data: boolean) => void;
  removeUserFromTeam: (id: string) => Promise<void>;
  handleJoinTeamClick: (id: string, data: Operation[]) => void;
  handleLeaveTeamClick: (id: string, data: Operation[]) => Promise<void>;
}

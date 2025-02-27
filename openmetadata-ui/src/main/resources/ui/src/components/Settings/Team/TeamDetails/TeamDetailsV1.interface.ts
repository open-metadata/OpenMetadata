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
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { EntityType } from '../../../../enums/entity.enum';
import { Team } from '../../../../generated/entity/teams/team';
import { EntityReference } from '../../../../generated/entity/type';

export interface TeamDetailsProp {
  assetsCount: number;
  currentTeam: Team;
  teams?: Team[];
  isTeamMemberLoading: number;
  isFetchingAdvancedDetails: boolean;
  isFetchingAllTeamAdvancedDetails: boolean;
  entityPermissions: OperationPermission;
  handleAddTeam: (value: boolean) => void;
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

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

import { MessagingProvider, Team } from '../../../generated/entity/teams/team';
import { OperationPermission } from '../../PermissionProvider/PermissionProvider.interface';

export interface TeamHierarchyProps {
  currentTeam?: Team;
  data: Team[];
  onTeamExpand: (
    loading?: boolean,
    parentTeam?: string,
    updateChildNode?: boolean
  ) => void;
  isFetchingAllTeamAdvancedDetails: boolean;
}

export interface MovedTeamProps {
  from: Team;
  to: Team;
}

export interface TableExpandableDataProps {
  expanded: boolean;
  onExpand: (record: Team, event: React.MouseEvent<HTMLElement>) => void;
  expandable: boolean;
  record: Team;
}

export enum TeamsPageTab {
  TEAMS = 'teams',
  USERS = 'users',
  ASSETS = 'assets',
  ROLES = 'roles',
  POLICIES = 'policies',
}

export interface TeamsInfoProps {
  parentTeams: Team[];
  isGroupType: boolean;
  childTeamsCount: number;
  currentTeam: Team;
  entityPermissions: OperationPermission;
  updateTeamHandler: (data: Team) => Promise<void>;
}

export interface TeamsSubscriptionProps {
  hasEditPermission: boolean;
  subscription?: MessagingProvider;
  updateTeamSubscription: (value?: SubscriptionWebhook) => Promise<void>;
}

export interface SubscriptionWebhook {
  webhook: string;
  endpoint: string;
}

export interface TeamsHeadingLabelProps {
  currentTeam: Team;
  entityPermissions: OperationPermission;
  updateTeamHandler: (data: Team) => Promise<void>;
}

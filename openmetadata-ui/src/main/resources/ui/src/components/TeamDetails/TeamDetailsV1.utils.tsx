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

import { isEmpty, isUndefined } from 'lodash';
import { Team } from '../../generated/entity/teams/team';
import { Paging } from '../../generated/type/paging';
import { filterEntityAssets } from '../../utils/EntityUtils';

export const getTabs = (
  currentTeam: Team,
  teamUserPagin: Paging,
  isGroupType: boolean,
  isOrganization: boolean,
  teamsCount: number
) => {
  const tabs = {
    teams: {
      name: 'Teams',
      isProtected: false,
      position: 1,
      count: teamsCount,
    },
    users: {
      name: 'Users',
      isProtected: false,
      position: 2,
      count: teamUserPagin?.total,
    },
    assets: {
      name: 'Assets',
      isProtected: false,
      position: 3,
      count: filterEntityAssets(currentTeam?.owns || []).length,
    },
    roles: {
      name: 'Roles',
      isProtected: false,
      position: 4,
      count: currentTeam?.defaultRoles?.length,
    },
    policies: {
      name: 'Policies',
      isProtected: false,
      position: 5,
      count: currentTeam?.policies?.length,
    },
  };

  const commonTabs = [tabs.roles, tabs.policies];

  if (isOrganization) {
    return [tabs.teams, ...commonTabs];
  }

  if (isGroupType) {
    return [tabs.users, tabs.assets, ...commonTabs];
  }

  return [tabs.teams, tabs.users, ...commonTabs];
};

export const searchTeam = (teams: Team[], value: string): Team[] => {
  let results: Team[] = [];
  for (const team of teams) {
    const hasChildren = !isUndefined(team.children) && !isEmpty(team.children);
    const matched =
      team?.name?.toLowerCase().includes(value.toLowerCase()) ||
      team?.displayName?.toLowerCase().includes(value.toLowerCase());
    if (matched) {
      results = [...results, { ...team, children: undefined }];
    }
    if (hasChildren) {
      results = [...results, ...searchTeam(team.children as Team[], value)];
    }
  }

  return results;
};

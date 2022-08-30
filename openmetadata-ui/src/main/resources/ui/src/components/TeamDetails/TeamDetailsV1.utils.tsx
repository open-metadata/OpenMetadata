/*
 *  Copyright 2022 Collate
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

import { Team } from '../../generated/entity/teams/team';
import { Paging } from '../../generated/type/paging';
import { filterEntityAssets } from '../../utils/EntityUtils';

export const getTabs = (
  currentTeam: Team,
  teamUserPagin: Paging,
  isOrganization: boolean
) => {
  const commonTabs = [
    {
      name: 'Roles',
      isProtected: false,
      position: 4,
      count: currentTeam?.defaultRoles?.length,
    },
    {
      name: 'Policies',
      isProtected: false,
      position: 5,
      count: currentTeam?.policies?.length,
    },
  ];

  if (isOrganization) {
    return [
      {
        name: 'Teams',
        isProtected: false,
        position: 1,
        count: currentTeam.children?.length || 0,
      },
      ...commonTabs,
    ];
  }

  return [
    {
      name: 'Teams',
      isProtected: false,
      position: 1,
      count: currentTeam.children?.length || 0,
    },
    {
      name: 'Users',
      isProtected: false,
      position: 2,
      count: teamUserPagin?.total,
    },
    {
      name: 'Assets',
      isProtected: false,
      position: 3,
      count: filterEntityAssets(currentTeam?.owns || []).length,
    },
    ...commonTabs,
  ];
};

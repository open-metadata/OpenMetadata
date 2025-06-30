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

import { Team } from '../../../../generated/entity/teams/team';
import i18n from '../../../../utils/i18next/LocalUtil';
import { TeamsPageTab } from './team.interface';

export const getTabs = (
  currentTeam: Team,
  isGroupType: boolean,
  isOrganization: boolean,
  teamsCount: number,
  assetsCount: number
) => {
  const tabs = {
    teams: {
      name: i18n.t('label.team-plural'),
      count: teamsCount,
      key: TeamsPageTab.TEAMS,
    },
    users: {
      name: i18n.t('label.user-plural'),
      count: currentTeam.users?.length ?? 0,
      key: TeamsPageTab.USERS,
    },
    assets: {
      name: i18n.t('label.asset-plural'),
      count: assetsCount,
      key: TeamsPageTab.ASSETS,
    },
    roles: {
      name: i18n.t('label.role-plural'),
      count: currentTeam?.defaultRoles?.length,
      key: TeamsPageTab.ROLES,
    },
    policies: {
      name: i18n.t('label.policy-plural'),
      count: currentTeam?.policies?.length,
      key: TeamsPageTab.POLICIES,
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

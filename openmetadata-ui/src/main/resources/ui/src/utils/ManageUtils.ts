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

import { toString } from 'lodash';
import AppState from '../AppState';
import { WILD_CARD_CHAR } from '../constants/char.constants';
import { Team } from '../generated/entity/teams/team';
import { User } from '../generated/entity/teams/user';
import { EntityReference } from '../generated/type/entityUsage';
import { getEntityName } from './CommonUtils';

/**
 * @param listUsers - List of users
 * @param listTeams - List of teams
 * @param excludeCurrentUser - Wether to exclude current user to be on list. Needed when calls from searching
 * @param searchQuery - search query for user or team
 * @returns List of user or team
 */
export const getOwnerList = (
  listUsers?: User[],
  listTeams?: Team[],
  excludeCurrentUser?: boolean,
  searchQuery?: string
) => {
  const userDetails = AppState.getCurrentUserDetails();

  const isAdminIncludeInQuery =
    getEntityName(userDetails).includes(toString(searchQuery)) ||
    searchQuery === WILD_CARD_CHAR
      ? true
      : false;

  if (userDetails?.isAdmin) {
    const users = (listUsers || [])
      .map((user) => ({
        name: getEntityName(user as unknown as EntityReference),
        value: user.id,
        group: 'Users',
        type: 'user',
      }))
      .filter((u) => u.value !== userDetails.id);
    const teams = (listTeams || []).map((team) => ({
      name: getEntityName(team),
      value: team.id,
      group: 'Teams',
      type: 'team',
    }));

    return [
      ...(!excludeCurrentUser && isAdminIncludeInQuery
        ? [
            {
              name: getEntityName(userDetails),
              value: userDetails.id,
              group: 'Users',
              type: 'user',
            },
          ]
        : []),
      ...users,
      ...teams,
    ];
  } else {
    return [
      {
        name: getEntityName(userDetails),
        value: userDetails?.id,
        group: 'Users',
        type: 'user',
      },
    ];
  }
};

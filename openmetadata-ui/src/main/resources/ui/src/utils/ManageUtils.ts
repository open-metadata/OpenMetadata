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

import { ReactNode } from 'react';
import AppState from '../AppState';
import { Team } from '../generated/entity/teams/team';
import { User } from '../generated/entity/teams/user';
import { getEntityName } from './CommonUtils';

export type OwnerItem = {
  name: string;
  value: string;
  group: string;
  type: string;
} & Record<string, ReactNode>;

/**
 * @param listUsers - List of users
 * @param listTeams - List of teams
 * @param excludeCurrentUser - Whether to exclude current user from the list
 * @param searchQuery - Search query for user or team
 * @returns List of users or teams
 */
export const getOwnerList = (
  listUsers: User[] = [],
  listTeams: Team[] = [],
  excludeCurrentUser = false
): OwnerItem[] => {
  const userDetails = AppState.getCurrentUserDetails();

  const users = listUsers.flatMap((user) =>
    user.id !== userDetails?.id
      ? [
          {
            name: getEntityName(user),
            value: user.id,
            group: 'Users',
            type: 'user',
          },
        ]
      : []
  );

  const teams = listTeams.map((team) => ({
    name: getEntityName(team),
    value: team.id,
    group: 'Teams',
    type: 'team',
  }));

  const currentUser =
    !excludeCurrentUser && userDetails
      ? [
          {
            name: getEntityName(userDetails),
            value: userDetails.id,
            group: 'Users',
            type: 'user',
          },
        ]
      : [];

  return [...currentUser, ...users, ...teams];
};

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

import AppState from '../AppState';
import { EntityReference } from '../generated/type/entityUsage';
import { getEntityName } from './CommonUtils';

export const getOwnerList = () => {
  const userDetails = AppState.getCurrentUserDetails();

  const userTeams =
    userDetails?.teams?.map((team) => ({
      name: getEntityName(team),
      value: team.id,
      group: 'Teams',
      type: 'team',
    })) ?? [];

  if (userDetails?.isAdmin) {
    const users = AppState.getAllUsers()
      .map((user) => ({
        name: getEntityName(user as unknown as EntityReference),
        value: user.id,
        group: 'Users',
        type: 'user',
      }))
      .filter((u) => u.value != userDetails.id);
    const teams = AppState.getAllTeams().map((team) => ({
      name: getEntityName(team),
      value: team.id,
      group: 'Teams',
      type: 'team',
    }));

    return [
      {
        name: getEntityName(userDetails as unknown as EntityReference),
        value: userDetails.id,
        group: 'Users',
        type: 'user',
      },
      ...users,
      ...teams,
    ];
  } else {
    return userDetails
      ? [
          {
            name: getEntityName(userDetails as unknown as EntityReference),
            value: userDetails.id,
            group: 'Users',
            type: 'user',
          },
          ...userTeams,
        ]
      : userTeams;
  }
};

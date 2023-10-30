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

import { isEqual } from 'lodash';
import { WILD_CARD_CHAR } from '../constants/char.constants';
import { SettledStatus } from '../enums/axios.enum';
import { SearchIndex } from '../enums/search.enum';
import { SearchResponse } from '../interface/search.interface';
import { getSearchedTeams, getSearchedUsers } from '../rest/miscAPI';
import { OidcUser } from './../components/authentication/auth-provider/AuthProvider.interface';
import { User } from './../generated/entity/teams/user';
import { formatTeamsResponse, formatUsersResponse } from './APIUtils';
import { getImages } from './CommonUtils';

export const getUserDataFromOidc = (
  userData: User,
  oidcUser: OidcUser
): User => {
  const images = oidcUser.profile.picture
    ? getImages(oidcUser.profile.picture)
    : undefined;
  const profileEmail = oidcUser.profile.email;
  const email =
    profileEmail && profileEmail.indexOf('@') !== -1
      ? profileEmail
      : userData.email;

  return {
    ...userData,
    email,
    displayName: oidcUser.profile.name,
    profile: images ? { images } : userData.profile,
  };
};

export const matchUserDetails = (
  userData: User,
  newUser: User,
  mapFields: Array<keyof User>
) => {
  let isMatch = true;
  for (const field of mapFields) {
    if (!isEqual(userData[field], newUser[field])) {
      isMatch = false;

      break;
    }
  }

  return isMatch;
};

export const searchFormattedUsersAndTeams = async (
  searchQuery = WILD_CARD_CHAR,
  from = 1
) => {
  try {
    const promises = [
      getSearchedUsers(searchQuery, from),
      getSearchedTeams(searchQuery, from, 'teamType:Group'),
    ];

    const [resUsers, resTeams] = await Promise.allSettled(promises);

    const users =
      resUsers.status === SettledStatus.FULFILLED
        ? formatUsersResponse(
            (resUsers.value.data as SearchResponse<SearchIndex.USER>).hits.hits
          )
        : [];
    const teams =
      resTeams.status === SettledStatus.FULFILLED
        ? formatTeamsResponse(
            (resTeams.value.data as SearchResponse<SearchIndex.TEAM>).hits.hits
          )
        : [];
    const usersTotal =
      resUsers.status === SettledStatus.FULFILLED
        ? resUsers.value.data.hits.total.value
        : 0;
    const teamsTotal =
      resTeams.status === SettledStatus.FULFILLED
        ? resTeams.value.data.hits.total.value
        : 0;

    return { users, teams, usersTotal, teamsTotal };
  } catch (error) {
    return { users: [], teams: [], usersTotal: 0, teamsTotal: 0 };
  }
};

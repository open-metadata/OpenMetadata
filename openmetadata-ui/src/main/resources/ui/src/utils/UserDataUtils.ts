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

import { AxiosError } from 'axios';
import { OidcUser } from 'components/authentication/auth-provider/AuthProvider.interface';
import { isEqual, isUndefined } from 'lodash';
import { SearchedUsersAndTeams } from 'Models';
import {
  getSearchedTeams,
  getSearchedUsers,
  getSuggestedTeams,
  getSuggestedUsers,
} from 'rest/miscAPI';
import { getUserById, getUserByName, getUsers } from 'rest/userAPI';
import AppState from '../AppState';
import { WILD_CARD_CHAR } from '../constants/char.constants';
import { SettledStatus } from '../enums/axios.enum';
import { SearchIndex } from '../enums/search.enum';
import { User } from '../generated/entity/teams/user';
import {
  RawSuggestResponse,
  SearchResponse,
} from '../interface/search.interface';
import { formatTeamsResponse, formatUsersResponse } from './APIUtils';
import { getImages } from './CommonUtils';

// Moving this code here from App.tsx
export const getAllUsersList = (arrQueryFields = ''): void => {
  getUsers(arrQueryFields, 1)
    .then((res) => {
      AppState.updateUsers(res.data);
    })
    .catch(() => {
      AppState.updateUsers([]);
    });
};

export const fetchAllUsers = () => {
  AppState.loadUserProfilePics();
  getAllUsersList('profile,teams,roles');
};

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

export const isCurrentUserAdmin = () => {
  return Boolean(AppState.getCurrentUserDetails()?.isAdmin);
};

export const fetchUserProfilePic = (userId?: string, username?: string) => {
  let promise;

  if (userId) {
    promise = getUserById(userId, 'profile');
  } else if (username) {
    promise = getUserByName(username, 'profile');
  } else {
    return;
  }

  AppState.updateProfilePicsLoading(userId, username);

  promise
    .then((res) => {
      const userData = res as User;
      const profile = userData.profile?.images?.image512 || '';

      AppState.updateUserProfilePic(userData.id, userData.name, profile);
    })
    .catch((err: AxiosError) => {
      // ignore exception
      AppState.updateUserProfilePic(
        userId,
        username,
        err.response?.status === 404 ? '' : undefined
      );
    })
    .finally(() => {
      AppState.removeProfilePicsLoading(userId, username);
    });
};

export const getUserProfilePic = (
  permission: boolean,
  userId?: string,
  username?: string
) => {
  let profile;
  if (userId || username) {
    profile = AppState.getUserProfilePic(userId, username);

    if (
      isUndefined(profile) &&
      !AppState.isProfilePicLoading(userId, username) &&
      permission
    ) {
      fetchUserProfilePic(userId, username);
    }
  }

  return profile;
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

export const suggestFormattedUsersAndTeams = (
  searchQuery: string
): Promise<SearchedUsersAndTeams> => {
  return new Promise<SearchedUsersAndTeams>((resolve, reject) => {
    const promises = [
      getSuggestedUsers(searchQuery),
      getSuggestedTeams(searchQuery),
    ];

    Promise.allSettled(promises)
      .then(([resUsers, resTeams]) => {
        const users =
          resUsers.status === SettledStatus.FULFILLED
            ? formatUsersResponse(
                (resUsers.value.data as RawSuggestResponse<SearchIndex.USER>)
                  .suggest['metadata-suggest'][0].options
              )
            : [];
        const teams =
          resTeams.status === SettledStatus.FULFILLED
            ? formatTeamsResponse(
                (resTeams.value.data as RawSuggestResponse<SearchIndex.TEAM>)
                  .suggest['metadata-suggest'][0].options
              )
            : [];
        resolve({ users, teams });
      })
      .catch((err: AxiosError) => {
        reject(err);
      });
  });
};
